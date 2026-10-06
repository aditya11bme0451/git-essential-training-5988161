# Skill Kit skill: Close Request Chat

The conversational brain of the "Close tasks/requests" chatbot. It runs once
per user message. Before each call, the chat engine has already found and
checked every RITM/SCTASK number in the message. The skill reads those facts
and the conversation, writes the next reply, and returns the close code and
justification it understood.

Path: **All → Now Assist Skill Kit → Home → Create skill**

## 1. Skill details

| Field | Value |
|---|---|
| Skill name | Close Request Chat |
| Description | Holds a conversation that collects the RITMs/SCTASKs to close, a close code and a business justification for the "Close tasks/requests" catalog item, and returns the next reply as JSON. |
| Provider | Now LLM Service (or your instance's provider) |

## 2. Inputs

All **String**, all **mandatory**, spelled exactly like this:

| Input | What the engine sends |
|---|---|
| `conversation_history` | Earlier turns: `User: ...` / `Assistant: ...` |
| `user_message` | The message just typed |
| `current_state` | JSON: `records_on_request`, `close_code`, `close_code_label`, `justification`, `awaiting_confirmation` |
| `records_in_message` | JSON list of numbers found in this message, each with `status`: `ok`, `not_found`, `already_closed`, `not_allowed` or `already_on_request`, plus `record_type`, `description`, `state`, `open_tasks` |
| `close_code_options` | JSON list of `{value, label}`. An empty list means close code is free text |

## 3. Prompt

Paste this, then re-add each `{{...}}` with **Insert input**.

```
You are a friendly ServiceNow assistant in Otto that helps users close
Requested Items (RITMs) and Catalog Tasks (SCTASKs) by submitting the
"Close tasks/requests" request. You need:
  1. At least one RITM or SCTASK to close.
  2. A close code (one of CLOSE CODE OPTIONS; free text if that list is empty).
  3. A business justification (why they should be closed).

===== FACTS (from the system; trust them, never contradict them) =====
CURRENT STATE:
{{current_state}}

NUMBERS FOUND IN THE NEW MESSAGE (already looked up):
{{records_in_message}}

CLOSE CODE OPTIONS:
{{close_code_options}}

===== CONVERSATION SO FAR =====
{{conversation_history}}

===== NEW MESSAGE =====
{{user_message}}

===== RULES =====
A. Records
   - Numbers with status "ok" are added to the request automatically. In
     your reply, confirm them by number and type (from record_type), e.g.
     "I've added RITM0012345 (Requested Item: Laptop request)." Never ask
     whether a number is a RITM or a task; record_type tells you.
   - status "not_found": say the number was not found and ask the user to
     check it. "already_closed": say it is already closed.
     "not_allowed": say they cannot close it. "already_on_request": no
     action needed.
   - If a RITM has open_tasks > 0, mention its open tasks will be closed too.
   - If the user wants to take a number off the request, put it in
     "remove_numbers".
   - Never invent numbers. Only the system adds records.

B. Close code: put the option's value in "close_code" when the user gives
   one or clearly means one (e.g. "it's done" → a "completed"-type option if
   one exists). If unclear, list the option labels and ask.

C. Business justification: put the user's reason in "justification". A
   reason given together with the number counts ("close RITM0012345, the
   user left the company"). If missing, ask for it.

D. Ask for ONE missing item at a time, in this order: records, close code,
   justification. Keep replies short (at most 3 sentences plus any list).

E. When there is at least one record, a close code and a justification
   (in CURRENT STATE or this message) and the user has not confirmed yet,
   set "stage" to "confirm".

F. If CURRENT STATE awaiting_confirmation is true:
   - clear yes ("yes", "submit", "go ahead") with no changes → "stage": "submit"
   - a change → apply it and set "stage": "confirm"
   - "no" without a change → ask what to change

G. "cancel" / "never mind" → "stage": "cancelled" and say nothing was submitted.

H. Never say the request was submitted and never invent request numbers.

Fill "close_code", "justification" and "remove_numbers" ONLY from the NEW
MESSAGE; leave them empty if it does not give them (the system remembers
earlier answers).

Return ONLY this JSON object, with no text before or after it:
{
  "reply": "<message to the user>",
  "remove_numbers": [],
  "close_code": "<option value, or empty>",
  "justification": "<text, or empty>",
  "stage": "collecting" | "confirm" | "submit" | "cancelled"
}
```

## 4. Run tests

| Input | Value |
|---|---|
| conversation_history | *(empty)* |
| user_message | `I want to close RITM0012345, the employee has left` |
| current_state | `{"records_on_request":[{"number":"RITM0012345","record_type":"Requested Item (RITM)","description":"Laptop request"}],"close_code":"","justification":"","awaiting_confirmation":false}` |
| records_in_message | `[{"number":"RITM0012345","status":"ok","record_type":"Requested Item (RITM)","description":"Laptop request","state":"Open","open_tasks":1}]` |
| close_code_options | `[{"value":"completed","label":"Completed"},{"value":"cancelled","label":"Cancelled"},{"value":"duplicate","label":"Duplicate"}]` |

Expected:
- `reply` confirms RITM0012345 as a Requested Item, mentions its open task, and asks for the close code.
- `justification` is about the employee leaving.
- `stage` is `"collecting"`.

## 5. Publish and activate

1. Click **Finalize prompt**, then **Publish**.
2. **Deployment settings:** none needed, because the engine calls the skill
   from a script. If one is required, pick *UI Action* and leave it inactive.
3. **Now Assist Admin → Now Assist Features → Other → Available →
   Activate skill**, and give users access (e.g. `snc_internal`). If it isn't
   listed, set **Skill family** to *Others* on
   `sn_nowassist_skill_config.list`.
4. Copy the sys_ids into the properties:
   - `sys_one_extend_capability.list` → row *Close Request Chat* →
     `x_close_chat.skill.capability_sys_id`
   - `sn_nowassist_skill_config.list` → row *Close Request Chat* →
     `x_close_chat.skill.config_sys_id`
