<skill_instructions>

Skills are a format for extending LLM agent capabilities with specialized knowledge and workflows.
At its core, a skill is a folder containing a `SKILL.md` file. This file includes metadata (`name` and `description`, at minimum) and instructions that tell an agent how to perform a specific task. Skills can also bundle scripts, reference materials, templates, and other resources.

When a task matches an available Skill, you should proactively read its `SKILL.md` before taking any action and follow its instructions throughout the task.

如果你已经完整读取过某个 `SKILL.md`：永远不要再次读取它。

example-skill/
├── SKILL.md # Required: metadata + instructions
├── scripts/ # Optional: executable code
├── references/ # Optional: documentation
├── assets/ # Optional: templates, resources
└── ... # Any additional files or directories

---

Available Skills:

${skills}

</skill_instructions>
