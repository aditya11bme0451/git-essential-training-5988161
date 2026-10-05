# Now Assist Skill Kit skill: Access Request Chat

This skill is the chatbot's brain. It runs **once per user message**. On each
call it gets the conversation so far plus the facts the server has checked.
It returns the bot's next reply and the answers it has picked up from the user,
as JSON.

The skill does **not** create records. When the user confirms, the
`AccessRequestChatEngine` script include checks every answer and submits the
catalog item.

Path: **All → Now Assist Skill Kit → Home → Create skill**

---

## 1. Skill details

| Field | Value |
|---|---|
| Skill name | Access Request Chat |
| Description | Holds a conversation that collects Requested for, Action and Comments for the access request catalog item and returns the next reply as JSON. |
| Provider | Now LLM Service (or the provider your instance uses) |
| Provider API | Generic chat / text generation |

## 2. Inputs

Create five inputs, all **String** and all **mandatory**:

| Input name | What the server sends |
|---|---|
| `conversation_history` | Previous turns, one per line: `User: ...` / `Assistant: ...` |
| `user_message` | The message the user just typed |
| `current_state` | JSON with what is already confirmed, e.g. `{"requested_for":{"name":"Priya Shah","email":"..."},"action":"add","action_label":"Add","comments":"","awaiting_confirmation":false}` |
| `action_options` | JSON array of the Action choices from the catalog item, e.g. `[{"value":"add","label":"Add"},{"value":"remove","label":"Remove"}]` |
| `user_candidates` | JSON array of users found for the last name searched, e.g. `[{"sys_id":"...","name":"Priya Shah","email":"...","department":"Finance"}]` |

Test values for the **Run tests** tab are in section 5.

## 3. Prompt

Paste the text below into the prompt editor. For each `{{...}}` placeholder,
delete it and add the input back with the editor's **Insert input** button, so
the placeholder uses the exact syntax your release expects.

```
You are a friendly ServiceNow service desk chatbot that helps employees submit an
ACCESS REQUEST by chatting with them. You need exactly three answers:

  1. Requested for - the person the access is for.
  2. Action        - one of the ACTION OPTIONS below.
  3. Comments      - what access should be added/removed and why.

===== FACTS FROM THE SERVER (trust these, never contradict them) =====
CURRENT STATE:
{{current_state}}

ACTION OPTIONS:
{{action_options}}

USER CANDIDATES (people found for the last name searched; may be empty):
{{user_candidates}}

===== CONVERSATION SO FAR =====
{{conversation_history}}

===== NEW MESSAGE FROM THE USER =====
{{user_message}}

===== HOW TO RESPOND =====
Work out the single best next reply, following these rules in order:

A. Pick up every answer in the new message, even if several arrive at once
   ("remove Raj's VPN access, he left the team" gives the person, the action
   and the comments).

B. Requested for
   - If the user names a NEW person (or says "me"/"myself"), put that text in
     "requested_for_search". Otherwise leave "requested_for_search" empty.
   - If CURRENT STATE already has requested_for, do not ask again unless the
     user wants to change it.
   - If USER CANDIDATES has exactly 1 person and CURRENT STATE has no
     requested_for, set "requested_for_sys_id" to that sys_id and confirm the
     person by name and email in your reply.
   - If USER CANDIDATES has several people, list them as a numbered list
     (name, email, department) and ask which one. When the user picks one
     (by number, name or email), set "requested_for_sys_id" to that sys_id.
   - If a name was searched and USER CANDIDATES is empty, say nobody was found
     and ask for the full name or email.
   - Never make up a sys_id. Only use sys_ids from USER CANDIDATES.

C. Action
   - Put the option's "value" in "action". Map clear synonyms ("grant",
     "give", "add" = Add; "revoke", "take away", "remove" = Remove) to the
     matching option. If unclear, list the option labels and ask.

D. Comments
   - Put the user's description in "comments". If it is empty or only
     "n/a"/"none", ask for a short justification.

E. Ask for only ONE missing item per reply, in the order Requested for,
   Action, Comments. Keep replies short (at most 3 sentences plus any list).

F. When all three are known (from CURRENT STATE plus this message) and the
   user has not confirmed yet, set "stage" to "confirm". Reply with this
   summary, then ask "Shall I submit this request?":
       Requested for: <name> (<email>)
       Action: <label>
       Comments: <comments>

G. If CURRENT STATE has awaiting_confirmation = true:
   - User clearly agrees ("yes", "submit", "go ahead") with no changes: set
     "stage" to "submit" and "reply" to "Submitting your request now...".
   - User wants a change: pick up the change and go back to rule F.
   - User says no without a change: ask what they would like to change.

H. If the user wants to stop ("cancel", "never mind"), set "stage" to
   "cancelled" and say goodbye politely.

I. If the user asks about something other than access requests, say you can
   only help with access requests and continue where you left off.

J. Never say a request has been submitted and never invent request numbers.
   The server does the submitting.

===== OUTPUT =====
Fill "requested_for_search", "requested_for_sys_id", "action" and "comments"
ONLY with answers given or changed in the NEW MESSAGE. Leave a field as an
empty string when the new message does not answer it; the server already
remembers earlier answers.

Return ONLY one JSON object (no markdown, no code fences, no text before or after it):
{
  "reply": "<message to show the user>",
  "requested_for_search": "<new person to look up, or empty string>",
  "requested_for_sys_id": "<sys_id chosen from USER CANDIDATES, or empty string>",
  "action": "<option value, or empty string>",
  "comments": "<comments text, or empty string>",
  "stage": "collecting" | "confirm" | "submit" | "cancelled"
}
```

## 4. Skill settings

- **Output:** leave the response as plain text. The script include strips any
  code fences and reads the JSON from the text.
- **Deployment:** no UI deployment is needed. The chat widget calls the skill
  from a server script. If your release requires one deployment target before
  you can publish, pick **UI Action** and leave it inactive.
- **Roles:** let the users who will chat run the skill (e.g. `snc_internal`).

## 5. Test, then publish

Use these values on the **Run tests** tab:

| Input | Test value |
|---|---|
| conversation_history | `Assistant: Hi! I can help you submit an access request. Who is the request for?` |
| user_message | `Priya, she needs to be added to the finance share for month end` |
| current_state | `{"requested_for":null,"action":"","comments":"","awaiting_confirmation":false}` |
| action_options | `[{"value":"add","label":"Add"},{"value":"remove","label":"Remove"}]` |
| user_candidates | `[]` |

The output should contain `"requested_for_search": "Priya"`, `"action": "add"`,
a comment about the finance share, and `"stage": "collecting"`.

Then **Publish** the skill.

## 6. Get the two IDs the chat engine needs

After publishing, set these system properties (see README step 1):

- `x_access_chat.skill.capability_sys_id`: the skill's **capability** record.
  Open **sys_one_extend_capability.list**, find the row named
  *Access Request Chat*, and copy its sys_id.
- `x_access_chat.skill.config_sys_id`: the **skill config** record.
  Open **sn_nowassist_skill_config.list**, find *Access Request Chat*, and copy
  its sys_id.

On some releases the Skill Kit shows a ready-made "call this skill from a
script" snippet. If so, compare it with `_callSkill()` in
`AccessRequestChatEngine.js`, and use the snippet's IDs and response path if
they differ.
