# Skill Kit skill: Validate Close Request

Works out which RITM or SCTASK the user wants closed, checks it really exists,
is open and may be closed by this user, and returns a decision plus a
friendly message.

- The **script tool** finds the numbers and looks them up (facts).
- The **prompt** reads the user's text plus those facts and decides.

Path: **All → Now Assist Skill Kit → Home → Create skill**

---

## 1. Skill details

| Field | Value |
|---|---|
| Skill name | Validate Close Request |
| Description | Identifies whether the RITM or SCTASK a user wants to close exists, which type it is, and whether it can be closed, and explains the result. |
| Provider | Now LLM Service (or your instance's provider) |

## 2. Inputs

| Input name | Type | Mandatory | What is passed |
|---|---|---|---|
| `user_text` | String | Yes | What the user typed for the number (the `record_number` variable), optionally with the reason |
| `requested_by` | String | Yes | sys_id of the person who submitted the close request |

## 3. Tool: look up the records

On the **Tools** step (*Add tool*), add a **Script** tool:

- **Tool name:** `lookup_records`
- **Inputs:** map `user_text` and `requested_by` from the skill inputs.
- **Script:** the editor pre-fills a template. Keep its wrapper and put this
  inside it, so the tool returns the facts as a JSON string:

```javascript
var facts = new global.CloseRecordValidator().validate(user_text, requested_by);
return JSON.stringify(facts);
```

If your release's template passes inputs through an object (for example
`inputs.user_text` or `context.user_text`), use that form instead.

If your release offers a **Script Include** tool type instead of inline
script, pick `CloseRecordValidator`, method `validate`, and map the two inputs
in this order: `user_text`, `requested_by`.

**Test the tool alone** on the tool's test panel with
`user_text = close ritm 10023 please` and your own user sys_id. You should get
`{"numbers_found":1,"records":[{"number":"RITM0010023","found":...}]}`.

## 4. Prompt

Paste this, then re-insert the three placeholders using **Insert input** (for
the two inputs) and **Insert tool output** (for `lookup_records`) so they use
your release's syntax.

```
You validate requests to close a ServiceNow Requested Item (RITM) or Catalog
Task (SCTASK).

WHAT THE USER TYPED:
{{user_text}}

FACTS FROM THE SYSTEM (authoritative; never contradict or add to them):
{{lookup_records.output}}

Each record in FACTS has: number, found, record_type, description, state,
active, requested_for, parent_ritm, open_tasks, user_can_close.

Decide ONE of:
- "close":   exactly one record in FACTS has found=true, active=true and
             user_can_close=true, and the user clearly means that record.
- "clarify": no number was found (numbers_found = 0), or several valid
             records were mentioned and it is unclear which one to close.
- "reject":  the record was not found, is already closed (active=false), or
             user_can_close=false.

Rules:
- Use ONLY numbers that appear in FACTS. Never invent or "correct" a number.
- The record type comes from FACTS (record_type). Never guess it from wording.
- If a RITM has open_tasks > 0, mention in the message that its open tasks
  will be closed too.
- "message" is for the end user: one or two plain sentences. For "close",
  say what will be closed (type, number, description). For "clarify", ask
  for the exact RITM or SCTASK number. For "reject", say why.

Return ONLY this JSON object, with no text before or after it:
{
  "decision": "close" | "clarify" | "reject",
  "number": "<the number from FACTS, or empty string>",
  "record_type": "<record_type from FACTS, or empty string>",
  "message": "<message for the user>"
}
```

## 5. Run tests

Use real numbers from your instance. Leave `requested_by` set to your own
sys_id, or to the sys_id of the requester of the record you test with.

| # | user_text | Expected |
|---|---|---|
| 1 | an open RITM you requested, e.g. `RITM0010023` | `close`, record_type Requested Item (RITM) |
| 2 | `please close sctask 10045, done` (an open task) | `close`, number `SCTASK0010045`, record_type Catalog Task (SCTASK) |
| 3 | `RITM9999999` | `reject`: not found |
| 4 | a closed SCTASK | `reject`: already closed |
| 5 | `close the laptop task` | `clarify`: asks for the number |
| 6 | `RITM0010023 and SCTASK0010045` | `clarify`: asks which one |

## 6. Publish, activate and deploy as a Flow action

1. Click **Finalize prompt**, then **Publish**.
2. **Skill settings → Deployment settings:** select **Flow action**, then
   publish again. This creates a Flow action that runs the skill, for use in
   the catalog item's flow.
3. **All → Now Assist Admin → Now Assist Features → Other → Available**: find
   *Validate Close Request* and click **Activate skill**, then **Activate**.
   If it isn't listed, set its **Skill family** to *Others* on
   `sn_nowassist_skill_config.list` (known issue KB1937798).
