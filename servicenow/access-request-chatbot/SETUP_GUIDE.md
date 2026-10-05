# Step-by-step configuration in ServiceNow

This guide configures the Access Request chatbot from scratch so it runs
**directly inside ServiceNow Otto chat**. The **Now Assist Skill Kit** provides
the AI. Do it in a sub-production instance first. Every file mentioned is in
this folder; paste its contents where indicated.

How it reaches Otto: Otto hands requests down to Virtual Agent topics and Now
Assist skills, and finds custom topics through their **topic description**.
So the chatbot is a small Virtual Agent topic. Each time the user answers, the
topic runs the chat engine, which calls the Skill Kit skill and, once the user
confirms, submits your catalog item.

```
User in Otto chat ──► Otto picks the "Submit access request" topic (from its description)
                        │  loop for every user message:
                        ▼
                      AccessRequestChatEngine ──► Skill Kit skill "Access Request Chat"
                        │  (checks answers; submits after "yes")
                        ▼
                      Catalog item submitted → REQ / RITM
```

| Phase | What you build | Time |
|---|---|---|
| A | Check prerequisites and collect catalog item details | 10 min |
| B | System properties | 5 min |
| C | Two script includes | 5 min |
| D | The Now Assist Skill Kit skill | 20 min |
| E | Activate the skill and connect it | 10 min |
| F | Test from a background script | 5 min |
| G | Virtual Agent topic that runs the chat | 20 min |
| H | Make the topic available in Otto | 10 min |
| I | Test in Otto chat | 10 min |
| Appendix | Optional portal chat widget (outside Otto) | 15 min |

---

## Phase A: Prerequisites

### A1. Check plugins and licence

1. Go to **All → System Definition → Plugins** (or **Application Manager** on
   newer releases).
2. Make sure these are installed:
   - **Now Assist Skill Kit** (`sn_skill_builder`)
   - A Now Assist application your instance is licensed for (for example Now
     Assist for ITSM or Now Assist for Platform). This provides the LLM.
   - **Glide Virtual Agent** (`com.glide.cs.chatbot`) with **Now Assist in
     Virtual Agent** enabled. Otto uses this to run Virtual Agent topics.
   - **Service Portal** (installed by default; only needed for the optional
     widget in the Appendix)
3. Go to **All → Now Assist Admin → Settings** and confirm an LLM provider is
   available (Now LLM Service, or your own Azure OpenAI or other provider).

### A2. Check your roles

Your account needs:
- `admin` for properties, script includes and widgets
- `sn_skill_builder.admin` for the Skill Kit
- `now_assist_admin` (or `admin`) to activate the skill
- `virtual_agent_admin` to build the Virtual Agent topic

### A3. Collect your catalog item details

1. Go to **All → Service Catalog → Catalog Definitions → Maintain Items**.
2. Open your catalog item.
3. **sys_id:** right-click the form header and choose **Copy sys_id**. Save it.
4. Scroll to the **Variables** related list and note the **Name** column (not
   the Question) for each variable:

   | Question | Type it should be | Note the Name, e.g. |
   |---|---|---|
   | Requested for | Reference (sys_user) or Requested For | `requested_for` |
   | Action | Select Box or Multiple Choice | `action` |
   | Comments | Multi Line Text or Single Line Text | `comments` |

5. Open the **Action** variable and check its **Question Choices** related list
   has the two choices (for example Text `Add` / Value `add`, and Text
   `Remove` / Value `remove`). The chatbot reads these choices from here.
6. Check the item is **Active** and that its *Available For* settings include
   the users who will chat. The request is submitted as the logged-in user.

---

## Phase B: System properties

1. In the navigator filter, type **sys_properties.list** and press Enter.
2. Click **New** and create each property below with **Type = string**:

| Name | Value |
|---|---|
| `x_access_chat.catalog_item_sys_id` | the sys_id from A3 |
| `x_access_chat.var.requested_for` | Requested for variable name (skip if `requested_for`) |
| `x_access_chat.var.action` | Action variable name (skip if `action`) |
| `x_access_chat.var.comments` | Comments variable name (skip if `comments`) |
| `x_access_chat.skill.capability_sys_id` | leave empty for now; filled in at E3 |
| `x_access_chat.skill.config_sys_id` | leave empty for now; filled in at E3 |

---

## Phase C: Script includes

1. Go to **All → System Definition → Script Includes → New**.
2. Create the first one:
   - **Name:** `AccessRequestCatalogUtils`
   - **Application:** Global
   - **Accessible from:** All application scopes
   - **Client callable:** unchecked
   - **Active:** checked
   - **Script:** replace everything with the contents of
     `script_include/AccessRequestCatalogUtils.js`
   - Click **Submit**.
3. Click **New** again and create the second one the same way:
   - **Name:** `AccessRequestChatEngine`
   - **Script:** contents of `script_include/AccessRequestChatEngine.js`
   - Click **Submit**.

---

## Phase D: Build the skill in the Now Assist Skill Kit

The full prompt text is in `nask_skill/access_request_chat_skill.md`. Keep that
file open while you work through this phase.

### D1. Create the skill

1. Go to **All → Now Assist Skill Kit → Home**.
2. Click **Create skill**.
3. Fill in:
   - **Skill name:** `Access Request Chat`
   - **Description:** `Holds a conversation that collects Requested for,
     Action and Comments for the access request catalog item and returns the
     next reply as JSON.`
4. Continue to the inputs step.

### D2. Add the inputs

Add five inputs. For each: **Data type = String**, **Mandatory = true**.

| Input name | Description to enter |
|---|---|
| `conversation_history` | Previous chat turns |
| `user_message` | Latest message from the user |
| `current_state` | JSON of answers already confirmed by the server |
| `action_options` | JSON list of valid Action choices |
| `user_candidates` | JSON list of users found for the last name searched |

The names must be typed exactly like this. The chat engine sends values under
these names.

### D3. Choose the provider

1. **Provider:** Now LLM Service, or the provider your instance uses.
2. **Provider API:** the generic chat / text generation API.
3. Continue to the prompt editor.

### D4. Write the prompt

1. Copy the prompt from section 3 of `nask_skill/access_request_chat_skill.md`
   (everything inside the code block, from "You are a friendly..." to the
   JSON example at the end).
2. Paste it into the prompt editor.
3. Find each placeholder (`{{current_state}}`, `{{action_options}}`,
   `{{user_candidates}}`, `{{conversation_history}}`, `{{user_message}}`).
   Delete it and add the same input back with the editor's **Insert input**
   button. This makes the placeholder use the exact syntax your release
   expects.
4. Click **Save**.

### D5. Test the prompt

1. Open the **Run tests** (or **Test**) tab.
2. Enter these values:

   | Input | Value |
   |---|---|
   | conversation_history | `Assistant: Hi! I can help you submit an access request. Who is the request for?` |
   | user_message | `Priya, she needs to be added to the finance share for month end` |
   | current_state | `{"requested_for":null,"action":"","comments":"","awaiting_confirmation":false}` |
   | action_options | `[{"value":"add","label":"Add"},{"value":"remove","label":"Remove"}]` |
   | user_candidates | `[]` |

3. Click **Run test**. The response should be a single JSON object containing:
   - `"requested_for_search": "Priya"`
   - `"action": "add"`
   - a `comments` value about the finance share
   - `"stage": "collecting"`
4. Run a confirmation test. Change these values and run again:
   - current_state: `{"requested_for":{"name":"Priya Shah","email":"priya@acme.com"},"action":"add","action_label":"Add","comments":"Finance share","awaiting_confirmation":true}`
   - user_message: `yes go ahead`

   You should get `"stage": "submit"`.
5. If the model adds text around the JSON, that is fine; the engine extracts
   the JSON. If it gets the fields wrong, adjust the wording of the rules and
   test again.

### D6. Publish

1. Click **Finalize prompt** (if your release has it), then **Publish**.
2. **Deployment settings:** the chatbot calls the skill from a server script,
   so no UI deployment is needed. If your release requires a deployment
   target before publishing, choose **UI Action** and leave it inactive.

---

## Phase E: Activate the skill and connect it

### E1. Activate the skill

1. Go to **All → Now Assist Admin → Now Assist Skills** (on some releases:
   **Now Assist Admin → Features**).
2. Find **Access Request Chat**. Custom skills are usually listed under
   **Platform** or **Other**.
3. Click **Activate skill**.

### E2. Choose who can use it

During activation (or afterwards in the skill's settings), give access to the
users who will chat, for example the role `snc_internal`. The skill runs as the
logged-in user, so users without access will get an error message in the chat.

### E3. Copy the two skill IDs into the properties

1. In the navigator filter, type **sys_one_extend_capability.list** and press
   Enter. Find the row named **Access Request Chat**, right-click it, choose
   **Copy sys_id**, and paste it into the property
   `x_access_chat.skill.capability_sys_id`.
2. Type **sn_nowassist_skill_config.list** and press Enter. Find **Access
   Request Chat**, copy its sys_id, and paste it into
   `x_access_chat.skill.config_sys_id`.

If your release shows a ready-made "call this skill from a script" snippet in
the skill, compare its IDs with these two and use the snippet's values if they
differ.

---

## Phase F: Test from a background script

1. Go to **All → System Definition → Scripts - Background**.
2. Paste the contents of `tests/background_script_test.js`.
3. If your Action label is not `Add`, change `ACTION` at the top.
4. Click **Run script** and check the output:
   - Line 1 lists your Add and Remove options.
   - Line 2 finds your own user.
   - Lines 3 and 4 return `"status":"error"`. This is expected: they check
     that bad input is rejected.
   - The BOT/USER lines show a natural conversation that ends with the
     "Here is your request..." summary.
5. Set `SUBMIT = true` and run the script once more. The last line should
   show a REQ number. Open that request and check that the RITM's variables
   (Requested for, Action, Comments) are filled in correctly. Then set
   `SUBMIT` back to `false`.

If you see `Sorry, I had trouble understanding that`, go to **All → System
Logs → Errors** and look for `AccessRequestChatEngine`. See Troubleshooting
below.

---

## Phase G: Virtual Agent topic that runs the chat

Otto runs this topic when a user asks for access. The topic is a loop: show
the bot's reply, take the user's answer, send it to the chat engine, and
repeat until the request is submitted or cancelled. All the scripts to paste
are in `virtual_agent_topic/`.

### G1. Create the topic

1. Go to **All → Conversational Interfaces → Virtual Agent → Designer**.
2. Click **Create → Topic**. If asked for a type, choose a topic for **LLM**
   discovery (not NLU or keyword only).
3. On the **Properties** tab, fill in:
   - **Name:** `Submit access request`
   - **Description:** this is what Otto reads to decide when to use the topic,
     so paste it exactly:

     > Submit an access request to add or remove access for yourself or another
     > employee. Use when someone wants to request, grant, give, add, remove,
     > revoke or take away access, and capture who it is for, whether to add or
     > remove, and comments.

   - **Category:** any, for example *IT*
   - **Discoverable:** checked
   - **Channels / experiences:** check every Now Assist / Otto option shown,
     for example *Now Assist in Virtual Agent*, *Now Assist Panel - Platform*,
     and your portal (such as *Employee Center* or *EmployeeWorks*).
4. Click **Save**.

### G2. Create the topic variables

Open the **Variables** panel (the *{ }* icon) and add four **Topic variables**,
all **String**:

| Name | Purpose |
|---|---|
| `chat_state` | Conversation state passed between turns |
| `bot_reply` | The bot's latest message |
| `chat_done` | `true` when the conversation has finished |
| `request_link` | Link to the submitted request |

### G3. Build the flow

Open the **Flow** tab. From the left palette, drag the nodes below onto the
canvas **in this order**, connecting each one to the next. To paste a script,
switch the field to **script mode** with the toggle or `</>` icon beside it.

**Node 1: Start chat** (*Utilities → Script Action*)
- **Node name:** `Start chat`
- **Action expression:** paste `virtual_agent_topic/1_start_chat_script_action.js`

**Node 2: Chat turn** (*User Input → Text*)
- **Node name:** `Chat turn`
- **Variable name:** `user_message`
- **Question:** switch to script mode and paste
  `virtual_agent_topic/2_chat_turn_prompt.js`
- Leave **Required** checked.

**Node 3: Process message** (*Utilities → Script Action*)
- **Node name:** `Process message`
- **Action expression:** paste `virtual_agent_topic/3_process_message_script_action.js`

**Node 4: Finished?** (*Utilities → Decision*)
- **Node name:** `Finished?`
- Add **Branch 1**:
  - **Name:** `Finished`
  - **Condition:** script mode, paste `virtual_agent_topic/4_is_done_condition.js`
- Add **Branch 2**:
  - **Name:** `Continue`
  - Mark it as the **default** branch (or give it the condition
    `return vaVars.chat_done != 'true';`).

**Node 5: Final reply** (*Bot Response → Text*), connected to the
**Finished** branch
- **Node name:** `Final reply`
- **Bot message:** script mode, paste `virtual_agent_topic/5_final_reply_text.js`

**Node 6: Request link** (*Bot Response → Link*), connected after Final reply
- **Node name:** `Request link`
- **Link URL:** script mode, paste the function from
  `virtual_agent_topic/6_request_link.js`
- **Link label:** `Open my request`
- **Conditions tab:** script mode, paste the condition in the same file's
  comment, so the link only shows when a request was created.
- Connect Request link to **End**.

**The loop:** drag the connector from the **Continue** branch of *Finished?*
back to the **Chat turn** node. If your designer version does not allow a
connector back to an earlier node, add a **Jump To** utility on the Continue
branch and point it at *Chat turn*.

The finished flow:

```
Start → Start chat → Chat turn → Process message → Finished? ─Finished─► Final reply → Request link → End
                         ▲                              │
                         └──────────── Continue ────────┘
```

### G4. Save, test and publish the topic

1. Click **Save**.
2. Click **Test** (top right). In the test window, have this conversation:
   - Bot: *"Hi! I can help you submit an access request. Who is the request for?..."*
   - You: `me`
   - You: `add`
   - You: `Read access to the Finance shared drive`
   - The bot shows the summary. You: `yes`
   - The bot replies *"Done! Your request REQ... has been submitted"* and shows
     **Open my request**.
3. Click **Publish**.

---

## Phase H: Make the topic available in Otto

### H1. Add the topic to the assistant Otto uses

1. Go to **All → Conversational Interfaces → Home** (on some releases
   **Virtual Agent → Assistant Designer** or **Now Assist Admin → Virtual
   Agent**).
2. Open the assistant your Otto / Now Assist chat uses. It is usually the
   default *Now Assist in Virtual Agent* assistant, or the one for your
   EmployeeWorks / Employee Center portal.
3. Make sure it uses **LLM topic discovery**.
4. In its **Topics** list, check that **Submit access request** is included
   and active. If not, click **Add topics**, select it, and save.

### H2. Make sure Otto uses this topic, not standard catalog ordering

Otto can also order catalog items conversationally without any custom work.
If it starts its own question-by-question form for your catalog item instead
of this topic, do both of the following:
1. Make the topic description in G1 more specific, for example by adding your
   team's own wording: *"finance share access", "application access"*.
2. Turn off conversational ordering for this one catalog item. Open the item,
   and in its Virtual Agent / conversational settings (or with **Hide in
   Virtual Agent** if your release has that option) exclude it from
   conversational catalog ordering. The topic still submits the item, because
   it uses the catalog API rather than the chat catalog search.

### H3. Who can use it

Topic access follows the topic's **Properties → Who can access this topic**
setting. Set it to the users who should be able to request access (for
example the `snc_internal` role). These users also need access to the skill
(Phase E2) and to the catalog item (A3).

---

## Phase I: Test in Otto chat

Log in as a normal user (impersonate one if needed), open Otto chat (in
EmployeeWorks, the Employee Center portal chat, or the Now Assist / Otto
panel), and run these conversations:

| # | You type in Otto | Expected result |
|---|---|---|
| 1 | `I need to request access` → `me` → `add` → `Read access to Finance drive` → `yes` | Otto hands over to the topic, shows the summary, then "Done! Your request REQ... has been submitted" with **Open my request** |
| 2 | `I need to remove access for John` → answer the questions | Asks which John if there are several, then continues with Action and Comments |
| 3 | At the summary, type `change the comment to temporary access until Friday` | Summary shown again with the new comment, nothing submitted |
| 4 | At the summary, type `no` | Asks what to change, nothing submitted |
| 5 | `cancel` at any point | Says goodbye and the topic ends |

The topic starts with its own greeting, so the details in your very first
message to Otto (for example the name in test 2) are asked for again in the
first question. Answer them there; after that, the bot picks up several
answers from a single message.

Finally, open the REQ from test 1 and check:
- **Requested for** on the request and the RITM is the chosen person.
- The **Action** and **Comments** variables have the values from the chat.
- Approvals and fulfilment start exactly as they would from the normal form.

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| "Sorry, the access request form is not available right now" | `x_access_chat.catalog_item_sys_id` is wrong, the item is inactive, or the Action variable name is wrong |
| "Sorry, I had trouble understanding that just now" | Check **System Logs → Errors** for `AccessRequestChatEngine`. "Skill IDs are not configured" means a step E3 property is empty. "Empty skill response" means wrong IDs, the skill isn't activated, or the user lacks access (E2) |
| Error mentions `model_output` or parsing | The response format differs on your release. Compare `_callSkill()` in `AccessRequestChatEngine.js` with the Skill Kit's script snippet |
| Bot never finds a person | The user's account must be active. Search by email to confirm |
| Bot keeps asking the same question | Re-check the D4 placeholders: an input that wasn't inserted with **Insert input** reaches the model empty |
| REQ is created but variables are empty | A variable name in the properties doesn't match the variable's **Name** (A3) |
| Otto answers itself or opens a catalog form instead of the topic | Re-check H1 (topic in the assistant, LLM discovery on) and H2 (description wording, conversational ordering for this item) |
| Topic starts but the bot repeats the greeting every turn | The **Continue** connector points to *Start chat* instead of *Chat turn* (G3) |
| Bot's question bubble is empty | The *Chat turn* Question field isn't in script mode, or the variable names in G2 don't match the scripts |
| Submission error about mandatory fields | The item has other mandatory variables. Add them to `submitRequest()` in `AccessRequestCatalogUtils.js`, to the prompt rules, and to `_isComplete()` in the engine |

---

## Appendix: Optional portal chat widget (outside Otto)

Only needed if you also want a standalone chat page on a portal.

1. Go to **All → Service Portal → Widgets → New**. Set **Name** to
   `Access Request Chat` and **ID** to `access-request-chat`, paste the four
   files from `widget/` into the matching fields (Body HTML template, CSS -
   SCSS, Client controller, Server script), and click **Submit**.
2. Go to **All → Service Portal → Pages → New**. Set **Title** to
   `Access Request Chat` and **ID** to `access_request_chat`, click **Submit**,
   then **Open in Designer**. Drag a 12-column container onto the page and the
   widget into it.
3. Open `https://<your-instance>.service-now.com/sp?id=access_request_chat`
   (replace `sp` with your portal's suffix, such as `esc`).
