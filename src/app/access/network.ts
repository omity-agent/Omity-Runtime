import ipaddr from "ipaddr.js";

import { localize } from "../../i18n/server";

type Address = ReturnType<typeof ipaddr.process>;
type Cidr = ReturnType<typeof ipaddr.parseCIDR>;
export interface ClientIdentity {
  address: string;
  local: boolean;
}
export class ClientNetwork {
  private readonly trustedProxies: Cidr[];
  constructor(trustedProxies: string[]) {
    this.trustedProxies = trustedProxies.map((cidr) => ipaddr.parseCIDR(cidr));
  }
  identify(remoteAddress: string | undefined, forwardedFor: string | undefined): ClientIdentity {
    const remote = parseAddress(remoteAddress),
      address = this.forwardedAddress(remote, forwardedFor);
    return { address: address.toString(), local: isLocal(address) };
  }
  private forwardedAddress(remote: Address, forwarded: string | undefined) {
    if (forwarded === undefined && remote.range() === "loopback") {
      return remote;
    }
    if (!this.matchesTrustedProxy(remote)) {
      if (forwarded !== undefined) {
        throw new Error(localize("access:network.untrustedForwardedFor"));
      }
      return remote;
    }
    if (forwarded === undefined) {
      throw new Error(localize("access:network.forwardedForMissing"));
    }
    const chain = forwarded.split(",").map((value) => parseAddress(value.trim()));
    if (chain.length === 0) {
      throw new Error(localize("access:network.forwardedForEmpty"));
    }
    let current = remote;
    for (
      let index = chain.length - 1;
      index >= 0 && this.matchesTrustedProxy(current);
      index -= 1
    ) {
      const next = chain[index];
      if (!next) {
        throw new Error(localize("access:network.forwardedForInvalid"));
      }
      current = next;
    }
    if (this.matchesTrustedProxy(current)) {
      throw new Error(localize("access:network.clientAddressMissingFromChain"));
    }
    return current;
  }
  private matchesTrustedProxy(address: Address) {
    return this.trustedProxies.some(
      ([network, prefix]) => address.kind() === network.kind() && address.match(network, prefix),
    );
  }
}
function parseAddress(value?: string) {
  if (!value || !ipaddr.isValid(value)) {
    throw new Error(
      localize("access:network.clientAddressInvalid", {
        value0: value ?? localize("errors:generic.missing"),
      }),
    );
  }
  return ipaddr.process(value);
}
function isLocal(address: Address) {
  const range = address.range();
  return (
    range === "loopback" || range === "linkLocal" || range === "private" || range === "uniqueLocal"
  );
}
