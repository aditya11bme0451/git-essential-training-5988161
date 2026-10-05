# Step-by-step configuration in ServiceNow

This guide configures the Access Request chatbot from scratch, using the
**Now Assist Skill Kit** for the AI. Do it in a sub-production instance first.
Every file mentioned is in this folder; paste its contents where indicated.

| Phase | What you build | Time |
|---|---|---|
| A | Check prerequisites and collect catalog item details | 10 min |
| B | System properties | 5 min |
| C | Two script includes | 5 min |
| D | The Now Assist Skill Kit skill | 20 min |
| E | Activate the skill and connect it | 10 min |
| F | Test from a background script | 5 min |
| G | Chat widget and portal page | 15 min |
| H | End-to-end test | 10 min |

---

## Phase A: Prerequisites

### A1. Check plugins and licence

1. Go to **All → System Definition → Plugins** (or **Application Manager** on
   newer releases).
2. Make sure these are installed:
   - **Now Assist Skill Kit** (`sn_skill_builder`)
   - A Now Assist application your instance is licensed for (for example Now
     Assist for ITSM or Now Assist for Platform). This provides the LLM.
   - **Service Portal** (installed by default)
3. Go to **All → Now Assist Admin → Settings** and confirm an LLM provider is
   available (Now LLM Service, or your own Azure OpenAI or other provider).

### A2. Check your roles

Your account needs:
- `admin` for properties, script includes and widgets
- `sn_skill_builder.admin` for the Skill Kit
- `now_assist_admin` (or `admin`) to activate the skill

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

## Phase G: Chat widget and portal page

### G1. Create the widget

1. Go to **All → Service Portal → Widgets → New**.
2. Fill in:
   - **Name:** `Access Request Chat`
   - **ID:** `access-request-chat`
3. Paste the four parts:

   | Widget field | File |
   |---|---|
   | Body HTML template | `widget/template.html` |
   | CSS - SCSS | `widget/style.scss` |
   | Client controller | `widget/client_controller.js` |
   | Server script | `widget/server_script.js` |

4. Click **Submit**.

### G2. Create the page

1. Go to **All → Service Portal → Pages → New**.
   - **Title:** `Access Request Chat`
   - **ID:** `access_request_chat`
   - **Roles:** leave empty for all logged-in users, or set e.g. `snc_internal`
2. Click **Submit**, then click **Open in Designer**.
3. Drag a **12-column container** onto the page, then drag the **Access
   Request Chat** widget into it.
4. The page is now at `https://<your-instance>.service-now.com/sp?id=access_request_chat`
   (replace `sp` with your portal's URL suffix if you use another portal, such
   as `esc`).

### G3. Make it easy to find (optional)

Choose one or more:
- **Catalog item:** add a line to the item's description, such as
  *"Prefer to chat? [Use the Access Request Assistant](?id=access_request_chat)"*.
- **Portal menu:** **Service Portal → Menus**, open your portal's header menu,
  and add a menu item of type *Page* pointing to `access_request_chat`.
- **Homepage:** add the widget to a homepage container in Designer.

---

## Phase H: End-to-end test

Open the page as a normal user (impersonate one if needed) and run these
conversations:

| # | You type | Expected result |
|---|---|---|
| 1 | `I need access for me` → `add` → `Read access to Finance drive` → `yes` | Summary shown, then "Done! Your request REQ... has been submitted" with an **Open** button |
| 2 | `Remove John's VPN access, he left the team` | Asks which John if there are several; picks up Remove and the comment from the first message |
| 3 | At the summary, type `change the comment to temporary access until Friday` | Summary shown again with the new comment, nothing submitted |
| 4 | At the summary, type `no` | Asks what to change, nothing submitted |
| 5 | `cancel` at any point | Says goodbye; the next message starts a new request |
| 6 | Click **Start over** | Fresh greeting |

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
| Submission error about mandatory fields | The item has other mandatory variables. Add them to `submitRequest()` in `AccessRequestCatalogUtils.js`, to the prompt rules, and to `_isComplete()` in the engine |
