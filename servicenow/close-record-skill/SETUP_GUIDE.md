# Close RITM or SCTASK with a Skill Kit validation skill

Your Otto catalog item for closing records stays the same, except that it no
longer asks *"Is this a RITM or a task?"*. Users type the number in any form
(`ritm 10023`, `SCTASK-45`, `close sctask0010045 please`). After submit, the
item's flow calls the Skill Kit skill **Validate Close Request**, which
identifies the record and decides whether it can be closed. The flow then
closes it, checking again first, and tells the user the result in the
request's comments.

```
Otto ──► Close item submitted (record_number, close_notes)
           │  flow
           ▼
         Skill "Validate Close Request"
           ├─ script tool: find numbers → look up RITM / SCTASK → facts
           └─ AI: decision close / clarify / reject + message
           ▼
         "Read close validation" action  → decision, number, message
           ▼
         decision = close? ── yes ─► "Close RITM or SCTASK" (re-checks, closes) ─► comment + Closed Complete
                           └─ no ──► comment with the reason + Closed Incomplete
```

| File | What it is |
|---|---|
| `script_include/CloseRecordValidator.js` | Number detection, record lookup, permission check, close, and reading the skill's reply |
| `nask_skill/validate_close_request_skill.md` | The skill: inputs, script tool, prompt, tests, publish/activate |
| `flow/read_skill_decision_action.js` | Script for the "Read close validation" flow action |
| `flow/close_record_action.js` | Script for the "Close RITM or SCTASK" flow action |
| `tests/background_test.js` | Checks the non-AI part from a background script |

---

## Step 1: Script include

1. Go to **All → System Definition → Script Includes → New**.
2. Fill in:
   - **Name:** `CloseRecordValidator`
   - **Accessible from:** All application scopes
   - **Client callable:** unchecked
   - **Script:** paste `script_include/CloseRecordValidator.js`
3. Click **Submit**.
4. Optional: in **Scripts - Background**, run `tests/background_test.js`
   (replace the sample numbers with real ones). Line 1 must show
   `["RITM0010023","SCTASK0000045","SCTASK0010045"]`.

If your instance uses other number prefixes or digit counts (**System
Definition → Number Maintenance**), change `TYPES` and `NUMBER_DIGITS` at
the top of the script include.

## Step 2: Change the catalog item

1. Go to **Service Catalog → Catalog Definitions → Maintain Items** and open
   your close item.
2. In **Variables**, open the "RITM or Task" type question and uncheck
   **Active** (or delete it). Otto stops asking it.
3. Open the number variable and set:
   - **Question:** `Which RITM or SCTASK do you want to close?`
   - **Name:** `record_number` (or keep yours and use it in step 5)
   - **Type:** Single Line Text, **Mandatory**
   - **Help text / Example:** `For example RITM0010023 or SCTASK0010045`
4. Keep a reason variable, e.g. `close_notes` (Multi Line Text).
5. Click **Update**.

## Step 3: Build the skill

Follow `nask_skill/validate_close_request_skill.md`:
1. Create the skill *Validate Close Request* with inputs `user_text` and
   `requested_by`.
2. Add the script tool `lookup_records`.
3. Paste the prompt and re-insert its placeholders.
4. Run the six tests in its table.
5. Finalize the prompt, publish, choose **Flow action** under Deployment
   settings, publish again, and activate it in **Now Assist Admin → Other**.

## Step 4: Create the two flow actions

**Action A: Read close validation**
1. Go to **All → Workflow Studio** (or **Flow Designer**) and click **New → Action**.
2. Set **Name** to `Read close validation` and click **Build action**.
3. **Inputs:** add `response` (String).
4. Add a **Script** step:
   - **Input variables:** `response` → drag the action input `response`
   - **Script:** paste `flow/read_skill_decision_action.js`
   - **Output variables:** `decision`, `number`, `record_type`, `message` (String)
5. **Outputs:** add the same four, each mapped to the script step's output.
6. Click **Save**, then **Publish**.

**Action B: Close RITM or SCTASK**
1. Click **New → Action**, set **Name** to `Close RITM or SCTASK`.
2. **Inputs:** add `record_number`, `close_notes`, `requested_by` (String).
3. Add a **Script** step:
   - **Input variables:** map the three inputs
   - **Script:** paste `flow/close_record_action.js`
   - **Output variables:** `status`, `message`, `record_type`, `closed_number` (String)
4. **Outputs:** add the same four, mapped to the script step.
5. Click **Save**, then **Publish**.

If you already built a "Close RITM or SCTASK" action from the earlier answer,
replace its script with `flow/close_record_action.js`. It now re-uses the
script include.

## Step 5: Wire the catalog item's flow

1. Open the flow that runs for your close item (trigger **Service Catalog**,
   set on the item's **Process Engine → Flow**). If there is none, create a
   **New → Flow** with trigger **Service Catalog** and select it on the item.
2. Add the steps below in order:

   | # | Step | Settings |
   |---|---|---|
   | 1 | **Get Catalog Variables** | *Submitted Request* = Trigger → Requested Item Record; *Template Catalog Item* = your close item; select `record_number`, `close_notes` |
   | 2 | **Validate Close Request** (the skill's Flow action, under *Now Assist* / your skill's spoke) | `user_text` = step 1 `record_number`; `requested_by` = Trigger → Requested Item Record → **Requested for** (sys_id) |
   | 3 | **Read close validation** | `response` = step 2 output **response** |
   | 4 | **If** | Condition: step 3 `decision` **is** `close` |
   | 5 | ↳ **Close RITM or SCTASK** (inside the If) | `record_number` = step 3 `number`; `close_notes` = step 1 `close_notes`; `requested_by` = same as step 2 |
   | 6 | ↳ **If** step 5 `status` is `ok` | **Update Record** on the trigger RITM: *Additional comments* = step 3 `message`, *State* = Closed Complete |
   | 7 | ↳ **Else** | **Update Record** on the trigger RITM: *Additional comments* = step 5 `message`, *State* = Closed Incomplete |
   | 8 | **Else** (of step 4: clarify / reject / error) | **Update Record** on the trigger RITM: *Additional comments* = step 3 `message`, *State* = Closed Incomplete |

3. Click **Save**, then **Activate**.

The skill action's output may have a different name on your release, for
example `response` or `output`. Use whichever output holds the skill's JSON.

## Step 6: Test in Otto

| You type in Otto | Expected result on the close request |
|---|---|
| `close RITM0010023, user left` (an open RITM you requested) | Otto doesn't ask for the type. RITM closed, plus its open tasks. Comment: *"Requested Item (RITM) RITM0010023 … will be closed"* |
| `close sctask 10045, done` | SCTASK0010045 identified as a Catalog Task and closed |
| `close RITM9999999` | Not closed. Comment says no such record exists |
| A number that's already closed | Comment says it's already closed |
| Someone else's RITM (you're not in its group) | Comment says you aren't allowed |
| `close the laptop task` | Comment asks for the exact RITM or SCTASK number |

**Where to look if something fails**
- The flow's **Executions** tab in Workflow Studio shows each step's inputs and
  outputs, including the skill's raw answer.
- **System Logs → Errors**.

## Optional: validate before submit instead of after

The flow validates **after** the user submits, so a wrong number ends as
Closed Incomplete with a comment. To have Otto check the number **during**
the chat (*"SCTASK0010045 is the 'Install software' task for Priya. Close
it?"*), use the same skill and script include from a Virtual Agent topic, as
in the access request chatbot. Ask if you want that version.
