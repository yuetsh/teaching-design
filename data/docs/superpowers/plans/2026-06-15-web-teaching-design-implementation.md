# Web Teaching Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a complete 18-lesson, 40-minute project-based Web front-end teaching design set in the `Web` directory.

**Architecture:** The curriculum is split into three six-lesson projects: an HTML personal homepage, a CSS campus activity website, and a JavaScript task management system. Each lesson is a standalone Markdown teaching design that follows the same table-based structure while advancing one observable project result.

**Tech Stack:** Markdown, HTML5, CSS3, vanilla JavaScript

---

### Task 1: Course Metadata And Authoring Rules

**Files:**
- Create: `Web/titles.md`
- Create: `Web/SKILLS.md`

- [x] **Step 1: Write the 18-title curriculum outline**

List all lessons under the three approved projects and preserve the exact order from the design specification.

- [x] **Step 2: Write Web teaching-design rules**

Define the target learners, project-driven method, 40-minute limit, required Markdown sections, three-dimensional objectives, five-column teaching-process table, four-character activity labels, and validation requirements.

- [x] **Step 3: Verify metadata**

Run:

```bash
rtk rg -n '个人主页|校园活动网站|任务管理系统|40分钟|教学成效与反思' Web/titles.md Web/SKILLS.md
```

Expected: all three projects and all required format rules are present.

### Task 2: HTML Personal Homepage Lessons

**Files:**
- Create: `Web/1.md`
- Create: `Web/2.md`
- Create: `Web/3.md`
- Create: `Web/4.md`
- Create: `Web/5.md`
- Create: `Web/6.md`

- [x] **Step 1: Write lessons 1-3**

Cover environment setup, HTML document/text structure, and images/links/multimedia. Each lesson must produce a working part of the personal homepage.

- [x] **Step 2: Write lessons 4-6**

Cover lists/tables, forms, and semantic integration/publishing. Lesson 6 must integrate and validate the complete project.

- [x] **Step 3: Verify project one**

Run:

```bash
rtk rg -L '1课时（40分钟）' Web/{1..6}.md
rtk rg -L '## 教学成效与反思' Web/{1..6}.md
```

Expected: no filenames are returned.

### Task 3: CSS Campus Activity Website Lessons

**Files:**
- Create: `Web/7.md`
- Create: `Web/8.md`
- Create: `Web/9.md`
- Create: `Web/10.md`
- Create: `Web/11.md`
- Create: `Web/12.md`

- [x] **Step 1: Write lessons 7-9**

Cover CSS foundations, the box model, and Flex layout. Keep all exercises tied to the campus activity website.

- [x] **Step 2: Write lessons 10-12**

Cover navigation/card components, responsive media queries, and final integration/debugging.

- [x] **Step 3: Verify project two**

Run:

```bash
rtk rg -L '1课时（40分钟）' Web/{7..12}.md
rtk rg -L '## 教学成效与反思' Web/{7..12}.md
```

Expected: no filenames are returned.

### Task 4: JavaScript Task Management Lessons

**Files:**
- Create: `Web/13.md`
- Create: `Web/14.md`
- Create: `Web/15.md`
- Create: `Web/16.md`
- Create: `Web/17.md`
- Create: `Web/18.md`

- [x] **Step 1: Write lessons 13-15**

Cover variables, conditions/loops, and functions/events using task data and controls.

- [x] **Step 2: Write lessons 16-18**

Cover DOM task creation, state/localStorage persistence, and final integration/testing/presentation.

- [x] **Step 3: Verify project three**

Run:

```bash
rtk rg -L '1课时（40分钟）' Web/{13..18}.md
rtk rg -L '## 教学成效与反思' Web/{13..18}.md
```

Expected: no filenames are returned.

### Task 5: Full Curriculum Validation

**Files:**
- Verify: `Web/*.md`

- [x] **Step 1: Check the file set**

Run:

```bash
rtk find Web -maxdepth 1 -type f
```

Expected: 20 Markdown files, consisting of 18 lessons, `titles.md`, and `SKILLS.md`.

- [x] **Step 2: Check required lesson sections**

Run checks for the title, lesson duration, three objectives, teaching process, board design, reflection, and five process rows in every numbered file.

- [x] **Step 3: Check lesson timing**

Extract the five teaching-process minute values from each lesson and confirm their sum is 40.

- [x] **Step 4: Review progression and examples**

Read the first, final, and transition lessons (`1.md`, `6.md`, `7.md`, `12.md`, `13.md`, `18.md`) and confirm project continuity, age-appropriate scope, accurate HTML/CSS/JavaScript examples, and no duplicated lesson task.
