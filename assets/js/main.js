const ngrok_link = "791b-2603-6080-9e00-80cf-00-1543.ngrok.io";                                                                                                                                                                                                 
//(DESC) Element defines from the webpage
const chat = document.querySelector("#chat");
const is_typing_box = document.querySelector("#is_typing_box");
const message_box = document.querySelector("#message_box");
const wipeBtn = document.querySelector("#wipe");
const uploadBtn = document.querySelector("#upload");
const sendBtn = document.querySelector("#send");
const callAudioElement = document.querySelector("#remoteAudio")
const userNotificationSound = document.querySelector("#userNotificationSound");
const systemNotificationSound = document.querySelector("#systemNotificationSound");


screenLock = null;
if('wakeLock' in navigator) {
  if (screenLock !== null && document.visibilityState === 'visible') {
    navigator.wakeLock.request('screen').then(lock => screenLock = lock).catch(err => console.log(err.name, err.message));
  }
}

document.addEventListener('visibilitychange', () => {
  if('wakeLock' in navigator) {
    if (screenLock !== null && document.visibilityState === 'visible') {
      navigator.wakeLock.request('screen').then(lock => screenLock = lock).catch(err => console.log(err.name, err.message));
    }
  }
});

inFullscreen = false;

















//(DESC) Custom class definitions and related helper functions
class Base {
  //(DESC) This class represents a data model that is identifiable by a Snowflake
  //id; //(TYPE) Snowflake {string}
  id = "";

  constructor(id = Base.#new_internal_client_snowflake) {
    this.id = id;
  }

  //(DESC) This generates a snowflake that is ALWAYS different from the server's snowflakes (its worker id is 0, which is reserved for internal client communication)
  static #snowflake_increment_id = 0n;
  static get #new_internal_client_snowflake() {
    let timestamp = BigInt(Date.now())
  
    let snowflake = (timestamp << 22n) + this.#snowflake_increment_id;
    if (this.#snowflake_increment_id < 0b111111111111) {
      this.#snowflake_increment_id += 1n;
    }
    else {
      this.#snowflake_increment_id = 0n;
    }
  
    return snowflake.toString(10);
  }

  static isConstructed(base_class_object) {
    let is_constructed = true;

    try {
      if (!base_class_object.hasOwnProperty("id")) is_constructed = false;
    }
    catch (err) {
      console.log("ERROR:",err);
      is_constructed = false;
    }

    return is_constructed;
  }

  static isValid(base_class_object) {
    let is_valid = true;

    try {
      if (typeof base_class_object.id !== "string" || isNaN(base_class_object.id) || base_class_object.id.trim() === "") is_valid = false;
    }
    catch (err) {
      console.log("ERROR:",err);
      is_valid = false;
    }

    return is_valid;
  }

  get timestamp() {
    let timestamp = (BigInt(this.id) >> 22n).toString(10);
    return timestamp;
  }

  static from(object_or_json_string) {
    let object;
    if (typeof object_or_json_string === "string") {
      try {
        object = JSON.parse(object_or_json_string);
      }
      catch (err) {
        console.log("ERROR:",err);
        return false;
      }
    }
    else if (typeof object_or_json_string === "object") {
      object = object_or_json_string;
    }
    if (typeof object === "object") { //(CODE) if (typeof object === "object" && this.isConstructed(object)) {
      return Object.assign(new this(), object);
    }
    else {
      console.log("ERROR: Could not create new class instance from object");
      return false; //(DESC) Object was invalid, did not create new class instance
    }
  }

  get object() {
    let parsed_object = {};
    try {
      parsed_object = JSON.parse(this.string);
    }
    catch (err) {
      console.log("ERROR:",err);
    }
    return parsed_object;
  }

  get string() {
    let json_string = "";
    try {
      json_string = JSON.stringify(this);
    }
    catch (err) {
      console.log("ERROR:",err);
    }
    return json_string;
  }
}

class ChatUser extends Base {
  //id; //(TYPE) Snowflake {string}
  nickname = ""; //(TYPE) string

  constructor(id = "", nickname = "") {
    super((id) ? id : undefined);
    this.nickname = nickname;
  }

  static isConstructed(user = new ChatUser()) {
    let is_constructed = true;

    try {
      if (!Base.isConstructed(user)) is_constructed = false;
      else if (!user.hasOwnProperty("nickname")) is_constructed = false;
    }
    catch (err) {
      console.log("ERROR:",err);
      is_constructed = false;
    }

    return is_constructed;
  }

  static isValid(user = new ChatUser()) {
    let is_valid = true;

    try {
      if (!Base.isValid(user)) is_valid = false;
      else if (typeof user.nickname !== "string" || user.nickname.trim() === "") is_valid = false;
    }
    catch (err) {
      console.log("ERROR:",err);
      is_valid = false;
    }

    return is_valid;
  }
}

class ChatMessage extends Base {
  //id; //(TYPE) Snowflake {string}
  author = new ChatUser(); //(TYPE) ChatUser
  content = ""; //(TYPE) string

  constructor(id = "", author = new ChatUser(), content = "") {
    super((id) ? id : undefined);
    this.author = author;
    this.content = content;
  }

  static isConstructed(message = new ChatMessage()) {
    let is_constructed = true;

    try {
      if (!Base.isConstructed(message)) is_constructed = false;
      else if (!ChatUser.isConstructed(message.author)) is_constructed = false;
      else if (!message.hasOwnProperty("content")) is_constructed = false;
    }
    catch (err) {
      console.log("ERROR:",err);
      is_constructed = false;
    }

    return is_constructed;
  }

  static isValid(message = new ChatMessage()) {
    let is_valid = true;

    try {
      if (!Base.isValid(message)) is_valid = false;
      else if (!ChatUser.isValid(message.author)) is_valid = false;
      else if (typeof message.content !== "string" || message.content.trim() === "") is_valid = false;
    }
    catch (err) {
      console.log("ERROR:",err);
      is_valid = false;
    }

    return is_valid;
  }
}

const system_ChatUser = new ChatUser("1337", "SYSTEM");
our_ChatUser = new ChatUser();
refresh_token = "";



























//(DESC) Fetch and define emoji table
emoji_definitions = {};
fetch("assets/data/emoji_definitions.json").then(async (resp) => {
    emoji_definitions = await resp.json();
})


//(DESC) Marked.js custom code
const renderer = {
  html(string) {
    return DOMPurify.sanitize(string, { ALLOWED_TAGS: ["del", "em", "strong", 'b', 'u', "code", "img", "video", "audio"], ALLOWED_ATTR: ["src", "controls", "type"] });
  },
  link(href, title, text) {
    try {
      href = encodeURI(href).replace(/%25/g, '%');
    } catch (e) {
      href = null
    }
    if (href === null) {
      return text;
    }
    var escapeTest = /[&<>"']/;
    var escapeReplace = /[&<>"']/g;
    var escapeTestNoEncode = /[<>"']|&(?!#?\w+;)/;
    var escapeReplaceNoEncode = /[<>"']|&(?!#?\w+;)/g;
    var escapeReplacements = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    var getEscapeReplacement = function getEscapeReplacement(ch) {
      return escapeReplacements[ch];
    };

    if (escapeTestNoEncode.test(href)) {
      href = href.replace(escapeReplaceNoEncode, getEscapeReplacement);
    }

    let out = '<a target="_blank" href="' + href + '"';
    if (title) {
      out += ' title="' + title + '"';
    }
    out += '>' + text + '</a>';
    return out;
  },
  image(href, title, text) {
    try {
      href = encodeURI(href).replace(/%25/g, '%');
    } catch (e) {
      href = null;
    }
    if (href === null) {
      return text;
    }

    if (text.includes(';')) {
      text_args = text.split(';');
      if (text_args.length === 3) {
        //(DESC) Defaults
        image_width = "400";
        image_height = "400";
        full_image_url = href;

        try {
          full_image_url = encodeURI(text_args[2]).replace(/%25/g, '%');
        } catch (e) {
          full_image_url = null;
        }
        if (full_image_url === null) {
          full_image_url = href;
        }
        if (!isNaN(text_args[0])) {
          image_width = text_args[0];
        }
        if (!isNaN(text_args[1])) {
          image_height = text_args[1];
        }
        full_image_url_domain = full_image_url.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n?]+)/gi)[0];
        href_domain = href.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n?]+)/gi)[0];
        if (href_domain !== full_image_url_domain) {
          console.log(href_domain+" != "+full_image_url_domain);
          full_image_url = href;
        }
        out = `<a target="_blank" style="display:block;max-width:${image_width}px;max-height:${image_height}px" href="${full_image_url}"><img src="${href}" style="max-width:${image_width}px;max-height:${image_height}px;width:100%;display:block;aspect-ratio:${image_width} / ${image_height}"></a>`;
      }
    } else {
      out = `<img src="${href}" alt="${text}"`;
      if (title) {
        out += ` title="${title}"`;
      }
      out += '>';
    }

    return out;
  }
};

//(DESC) Adding custom underline support using double underscores
const underline = {
  name: 'underline',
  level: 'inline',                                  // Is this a block-level or inline-level tokenizer?
  start(src) { return src.match(/__/)?.index; },    // Hint to Marked.js to stop and check for a match
  tokenizer(src, tokens) {
    const rule = /^__([^__\n]+)__/;
    const match = rule.exec(src);
    if (match) {
      return {                                         // Token to generate
        type: 'underline',                             // Should match "name" above
        raw: match[0],                                 // Text to consume from the source
        child_tokens: this.lexer.inlineTokens(match[1])
      };
    }
  },
  renderer(token) {
    return `<u>${this.parser.parseInline(token.child_tokens)}</u>`;
  }
};

const spoiler = {
  name: 'spoiler',
  level: 'inline', // Is this a block-level or inline-level tokenizer?
  start(src) { return src.match(/\|\|/)?.index; }, // Hint to Marked.js to stop and check for a match
  tokenizer(src, tokens) {
    const rule = /^\|\|([^\|\|\n]+)\|\|/; // Regex for the complete token, anchor to string start
    const match = rule.exec(src);
    if (match) {
      return { // Token to generate
        type: 'spoiler', // Should match "name" above
        raw: match[0], // Text to consume from the source
        child_tokens: this.lexer.inlineTokens(match[1])
      };
    }
  },
  renderer(token) {
    return `<span class="spoiler_hidden" onclick="this.setAttribute('class', 'spoiler_shown');this.removeAttribute('onclick');event.stopPropagation();event.stopImmediatePropagation()">${this.parser.parseInline(token.child_tokens)}</span>`;
  }
};

//(DESC) Adding custom underline support using double underscores
const emoji = {
  name: 'emoji',
  level: 'inline', // Is this a block-level or inline-level tokenizer?
  start(src) { return src.match(/\:/)?.index; }, // Hint to Marked.js to stop and check for a match
  tokenizer(src, tokens) {
    const rule = /^\:([^:\n]+)\:/; // Regex for the complete token, anchor to string start
    const match = rule.exec(src);
    if (match) {
      return { // Token to generate
        type: 'emoji', // Should match "name" above
        raw: match[0], // Text to consume from the source
        child_tokens: this.lexer.inlineTokens(match[1])
      };
    }
  },
  renderer(token) {
    if (emoji_definitions.hasOwnProperty(token.child_tokens[0]?.text)) {
      return emoji_definitions[token.child_tokens[0].text];
    }
    else {
      if (token.child_tokens[0]) {
        return ":"+token.child_tokens[0]?.text+":";
      }
      else {
        return "::";
      }
    }
  }
};

//(DESC) Apply changes to marked
marked.use({ renderer, extensions: [spoiler, underline, emoji]});































//(DESC) Browser stuff and function and variable defines
muted = !(document.body.getAttribute("data-interacted"));
//console.log("muted = "+muted);
if (muted) {
  //(BAD)(UGLY)(TODO) Make this not suck as thoroughly as it does
  function documentWasInteractedWith() {
    muted = false;
    if (document.body.hasAttribute("data-interacted")) {document.body.removeAttribute("data-interacted")}
    if (document.body.hasAttribute("onclick")) {document.body.removeAttribute("onclick")}
    if (document.body.hasAttribute("onscroll")) {document.body.removeAttribute("onscroll")}
    if (document.body.hasAttribute("onkeypress")) {document.body.removeAttribute("onkeypress")}
    document.body.removeEventListener("click", documentWasInteractedWith);
    document.body.removeEventListener("scroll", documentWasInteractedWith);
    document.body.removeEventListener("keypress", documentWasInteractedWith);
  }
  document.body.addEventListener("click", documentWasInteractedWith);
  document.body.addEventListener("scroll", documentWasInteractedWith);
  document.body.addEventListener("keypress", documentWasInteractedWith);
}

keepalive_timeout_id = false;

//(TODO) Add cached property that can have values false, "above", or "below" to each message

//(NOTE) message_ids_array = [message_id_oldest, message_id_second_oldest, message_id_third_oldest... message_id_newest]
//(NOTE) message_ids_metadata_array = [message_metadata_oldest, message_metadata_second_oldest, message_metadata_third_oldest... message_metadata_newest]
//(NOTE) message_metadata = {"cached": cached_value}
//(NOTE) cached_value = false || "above" || "below"
var message_ids_array = []; //(NOTE) DO NOT ADD TO THIS ARRAY MANUALLY!!!
var message_ids_metadata_array = []; //(NOTE) DO NOT ADD TO THIS ARRAY MANUALLY!!!

function add_message_to_message_ids_array(id, cached=false) {
  //(DESC) Add id (in order, oldest message is at the 0 index, newest message is at the -1 index) to message_ids_array, 
  //       then add the message_metadata to the message_ids_metadata_array in the EXACT SAME PLACE as the id in the message_ids_array, 
  //       THEN return the index of the id added to message_ids_array.

  let metadata = {cached: cached};
  //(NOTE) between_message_ids = {older: message_id_that_is_older_than_id || false, newer: message_id_that_is_newer_than_id || false};
  let between_message_ids = {older: false, newer: false};
  if (message_ids_array.length === 0 || BigInt(id) > BigInt(message_ids_array[message_ids_array.length-1])) {
    //(DESC) This message is the newest (or only, that still makes it the newest) message, add it to the end of the array.
    if (message_ids_array.length !== 0) {
      between_message_ids.older = message_ids_array[message_ids_array.length-1];
    }

    message_ids_array.push(id);
    message_ids_metadata_array.push(metadata);

    //(DESC) Add chat message to the end of chat ~~and scroll to bottom~~
    /*chat.appendChild(chat_message_div);
    if (scrolled_to_bottom) {
      chat_wrapper.scrollTop = chat_wrapper.scrollHeight;
    }
    //(TODO) Else, show that there is a new message somehow.
    */
  }
  else if (BigInt(id) < BigInt(message_ids_array[0])) {
    //(DESC) This message is the oldest message, add it to the beginning of the array.
    between_message_ids.newer = message_ids_array[0];

    message_ids_array.unshift(id);
    message_ids_metadata_array.unshift(metadata);

    //chat.insertBefore(chat_message_div, chat.firstElementChild);
  }
  else {
    //(DESC) This message is between the oldest message and the newest message. Find it's place and insert it there.
    for (let i=0;i<message_ids_array.length;i++) {
      if (BigInt(message_ids_array[i]) <= BigInt(id) && BigInt(message_ids_array[i+1]) >= BigInt(id)) {
        //(NOTE) id is between message_ids_array[i] and message_ids_array[i+1]
        //(NOTE) id is newer than message_ids_array[i] and older than message_ids_array[i+1]
        between_message_ids.older = message_ids_array[i];
        between_message_ids.newer = message_ids_array[i+1];
        message_ids_array.splice(i+1, 0, id);
        message_ids_metadata_array.splice(i+1, 0, metadata);
        break;
      }
    }

    //chat.insertBefore(chat_message_div, document.getElementById(between_message_ids[1].toString()));
  }
  //(DESC) All checks have been completed, return message.
  return {between_message_ids: between_message_ids, id: id, metadata: metadata};
}

function remove_message_from_message_ids_array(id) {
  //(DESC) Remove id from message_ids_array and return the removed message
  //(NOTE) between_message_ids = {older: message_id_that_is_older_than_id || false, newer: message_id_that_is_newer_than_id || false};
  let between_message_ids = {older: false, newer: false};
  if (message_ids_array.length === 0) {
    console.log("ERROR: Tried to remove a message id from message_ids_array when message_ids_array is empty!!");
    return false;
  }
  
  let message_index = message_ids_array.indexOf(id);
  if (message_index === -1) {
    console.log("ERROR: Tried to remove a message id from message_ids_array that does not exist in the array!!");
    return false;
  }

  //(NOTE) id is between message_ids_array[message_index-1] and message_ids_array[message_index+1]
  //(NOTE) message_ids_array[message_index-1] is OLDER than id and message_ids_array[message_index+1] is NEWER than id.
  if (message_index !== 0) { //(NOTE) First (oldest) message
    between_message_ids.older = message_ids_array[message_index-1];
  }
  if (message_index !== message_ids_array.length-1) { //(NOTE) Last (newest) message
    between_message_ids.newer = message_ids_array[message_index+1];
  }
  let removed_message_id = message_ids_array.splice(message_index, 1)[0];
  let removed_message_metadata = message_ids_metadata_array.splice(message_index, 1)[0];
        
  //(DESC) All checks have been completed, message has been removed, return message.
  return {between_message_ids: between_message_ids, id: removed_message_id, metadata: removed_message_metadata};
}

function set_metadata_of_message_from_message_ids_array(id, metadata) {
  //(DESC) Set the metadata of a message and then return the message
  let between_message_ids = {older: false, newer: false};
  if (message_ids_array.length === 0) {
    console.log("ERROR: Tried to set metadata of a message id from message_ids_array when message_ids_array is empty!!");
    return false;
  }
  
  let message_index = message_ids_array.indexOf(id);
  if (message_index === -1) {
    console.log("ERROR: Tried to set metadata of a message id from message_ids_array that does not exist in the array!!");
    return false;
  }

  //(NOTE) id is between message_ids_array[message_index-1] and message_ids_array[message_index+1]
  //(NOTE) message_ids_array[message_index-1] is OLDER than id and message_ids_array[message_index+1] is NEWER than id.
  if (message_index !== 0) { //(NOTE) First (oldest) message
    between_message_ids.older = message_ids_array[message_index-1];
  }
  if (message_index !== message_ids_array.length-1) { //(NOTE) Last (newest) message
    between_message_ids.newer = message_ids_array[message_index+1];
  }

  //(DESC) Set message metadata
  message_ids_metadata_array[message_index] = metadata;

  //(DESC) All checks have been completed, message metadata has been set, return message.
  return {between_message_ids: between_message_ids, id: id, metadata: message_ids_metadata_array[message_index]};
}

function get_metadata_of_message_from_message_ids_array(id) {
  //(DESC) Get the metadata of a message and then return the metadata
  if (message_ids_array.length === 0) {
    console.log("ERROR: Tried to get metadata of a message id from message_ids_array when message_ids_array is empty!!");
    return false;
  }
  
  let message_index = message_ids_array.indexOf(id);
  if (message_index === -1) {
    console.log("ERROR: Tried to get metadata of a message id from message_ids_array that does not exist in the array!!");
    return false;
  }

  //(DESC) All checks have been completed, message metadata has been set, return message.
  return message_ids_metadata_array[message_index];
}

function add_message_to_above_cache(id) {
  //(DESC) Add this message element to the above cache, then return the element (for removal by caller function)
  if (message_ids_array.length === 0) {
    console.log("ERROR: Tried get a message element when message_ids_array is empty!!");
    return false;
  }
  let message_index = message_ids_array.indexOf(id);
  if (message_index === -1) {
    console.log("ERROR: Tried get a message element with an id that does not exist in message_ids_array!!");
    return false;
  }
  let message_element = document.getElementById(id);
  add_element_to_above_cache(message_element);
  //(DESC) Message has been added to the above cache, return the element (for removal by the caller function)
  return message_element;
}

function add_message_to_below_cache(id) {
  //(DESC) Add this message element to the below cache, then return the element (for removal by caller function)
  if (message_ids_array.length === 0) {
    console.log("ERROR: Tried get a message element when message_ids_array is empty!!");
    return false;
  }
  let message_index = message_ids_array.indexOf(id);
  if (message_index === -1) {
    console.log("ERROR: Tried get a message element with an id that does not exist in message_ids_array!!");
    return false;
  }
  let message_element = document.getElementById(id);
  add_element_to_below_cache(message_element);
  //(DESC) Message has been added to the below cache, return the element (for removal by the caller function)
  return message_element;
}

//(NOTE)//(TODO) If this doesn't work, clone the element and add THAT to the above cache.
function add_element_to_above_cache(message_element) {
  //(DESC) Add this message element to the above cache, then return the element (for removal by caller function)
  if (message_element === null) {
    console.log("ERROR: Tried get a message element that is not in the document!!");
    return false;
  }
  if (message_element.id === undefined) {
    console.log("ERROR: Tried to add a message element to the above cache that has no id!!");
    console.log("Message element:",message_element);
    return false;
  }
  if (message_ids_array.length === 0) {
    console.log("ERROR: Tried get a message element when message_ids_array is empty!!");
    return false;
  }
  let message_index = message_ids_array.indexOf(message_element.id);
  if (message_index === -1) {
    console.log("ERROR: Tried get a message element with an id that does not exist in message_ids_array!!");
    return false;
  }

  if (message_elements_above_cache.length === 0 || BigInt(message_element.id) >= BigInt(message_elements_above_cache[message_elements_above_cache.length-1].id)) {
    //(DESC) This message is the newest (or only, that still makes it the newest) message in message_elements_above_cache array, add it to the end of the array.    
    message_elements_above_cache.push(message_element);
  }
  else if (BigInt(message_element.id) <= BigInt(message_elements_above_cache[0].id)) {
    //(DESC) This message is the oldest message in message_elements_above_cache array, add it to the beginning of the array.
    message_elements_above_cache.unshift(message_element);
  }
  else {
    //(DESC) This message is between the oldest message and the newest message in message_elements_above_cache array. Find it's place and insert it there.
    for (let i=0;i<message_elements_above_cache.length;i++) {
      if (message_elements_above_cache[i+1].id === undefined) {
        console.log("ERROR: message_elements_above_cache[i+1] is undefined!!!");
        console.log("i=",i,"message_elements_above_cache.length=",message_elements_above_cache.length,"message_elements_above_cache[i]=",message_elements_above_cache[i]);
        return false;
      }
      else if (BigInt(message_elements_above_cache[i].id) <= BigInt(message_element.id) && BigInt(message_elements_above_cache[i+1].id) >= BigInt(message_element.id)) {
        //(NOTE) message_element.id is between message_elements_above_cache[i] and message_elements_above_cache[i+1]
        //(NOTE) message_element.id is newer than message_elements_above_cache[i] and older than message_elements_above_cache[i+1]
        message_elements_above_cache.splice(i+1, 0, message_element);
        break;
      }
    }
  }

  //(DESC) Add that the message has been cached to message_ids_metadata_array
  set_metadata_of_message_from_message_ids_array(message_element.id, {cached: "above"});

  //(DESC) Message has been added to the above cache, return the element (for removal by the caller function)
  return message_element;
}

function add_element_to_below_cache(message_element) {
  //(DESC) Add this message element to the below cache, then return the element (for removal by caller function)
  if (message_element === null) {
    console.log("ERROR: Tried get a message element that is not in the document!!");
    return false;
  }
  if (message_element.id === undefined) {
    console.log("ERROR: Tried to add a message element to the above cache that has no id!!");
    console.log("Message element:",message_element);
    return false;
  }
  if (message_ids_array.length === 0) {
    console.log("ERROR: Tried get a message element when message_ids_array is empty!!");
    return false;
  }
  let message_index = message_ids_array.indexOf(message_element.id);
  if (message_index === -1) {
    console.log("ERROR: Tried get a message element with an id that does not exist in message_ids_array!!");
    return false;
  }

  if (message_elements_below_cache.length === 0 || BigInt(message_element.id) <= BigInt(message_elements_below_cache[message_elements_below_cache.length-1].id)) {
    //(DESC) This message is the oldest (or only, that still makes it the oldest) message in message_elements_below_cache array, add it to the end of the array.    
    message_elements_below_cache.push(message_element);
  }
  else if (BigInt(message_element.id) >= BigInt(message_elements_below_cache[0].id)) {
    //(DESC) This message is the newest message in message_elements_below_cache array, add it to the beginning of the array.
    message_elements_below_cache.unshift(message_element);
  }
  else {
    //(DESC) This message is between the oldest message and the newest message in message_elements_below_cache array. Find it's place and insert it there.
    for (let i=0;i<message_elements_below_cache.length;i++) {
      if (message_elements_below_cache[i+1].id === undefined) {
        console.log("ERROR: message_elements_below_cache[i+1] is undefined!!!");
        console.log("i=",i,"message_elements_below_cache.length=",message_elements_below_cache.length,"message_elements_below_cache[i]=",message_elements_below_cache[i]);
        return false;
      }
      else if (BigInt(message_elements_below_cache[i].id) >= BigInt(message_element.id) && BigInt(message_elements_below_cache[i+1].id) <= BigInt(message_element.id)) {
        //(NOTE) message_element.id is between message_elements_below_cache[i] and message_elements_below_cache[i+1]
        //(NOTE) message_element.id is older than message_elements_below_cache[i] and newer than message_elements_below_cache[i+1]
        message_elements_below_cache.splice(i+1, 0, message_element);
        break;
      }
    }
  }

  //(DESC) Add that the message has been cached to message_ids_metadata_array
  set_metadata_of_message_from_message_ids_array(message_element.id, {cached: "below"});

  //(DESC) Message has been added to the above cache, return the element (for removal by the caller function)
  return message_element;
}


var message_elements_above_cache = [];
var message_elements_below_cache = [];


function check_chat_elements_above_and_below() {
  if (chat.firstElementChild === null) return;
  if (chat.firstElementChild.getBoundingClientRect().bottom <= chat_wrapper.clientHeight * -5) {
    //(DESC) This element is too far above the viewport, add it (in it's proper order, oldest message at the 0 index, newest message at the -1 index (last)) to the message_elements_above_cache array and remove it from the chat
    while (true) { //(DESC) Limit the otherwise infinite loop to 100 iterations.
      if (chat.firstElementChild.getBoundingClientRect().bottom <= chat_wrapper.clientHeight * -5) {
        let cached_message_element = add_element_to_above_cache(chat.firstElementChild);
        if (cached_message_element === false) {
          console.log("ERROR: Could not cache message element to above cache");
          break;
        }
        else {
          //(DESC) The child has been cached, remove it.
          chat.removeChild(cached_message_element);
        }
      }
      else {
        break;
      }
    }
  }
  //(NOTE) Add this back once add_message_to_below_cache has been completed.
  if (chat.lastElementChild.getBoundingClientRect().top >= chat_wrapper.clientHeight * 6) {
    //(DESC) This element is too far below the viewport, add it (in it's proper order) to the message_elements_below_cache array and then remove it from the chat
    while (true) { //(DESC) Limit the otherwise infinite loop to 100 iterations.
      if (chat.lastElementChild.getBoundingClientRect().top >= chat_wrapper.clientHeight * 6) {
        let cached_message_element = add_element_to_below_cache(chat.lastElementChild);
        if (cached_message_element === false) {
          console.log("ERROR: Could not cache message element to below cache");
          break;
        }
        else {
          //console.log("below_cached_element");
          chat.removeChild(chat.lastElementChild);
        }
      }
      else {
        break;
      }
    }
  }

  if (message_elements_above_cache.length > 0) {
    for (let i=0;i < 50;i++) { //(DESC) Limit the otherwise infinite loop to 50 iterations.
      if (message_elements_above_cache.length > 0 && chat_wrapper.scrollTop <= chat_wrapper.clientHeight) {
        //(DESC) User is scrolling to the top, we need to pull the LAST message (message_elements_above_cache.pop()) from the message_elements_above_cache array and add it to the beginning of the chat
        let uncached_message = message_elements_above_cache.pop();

        chat.insertBefore(uncached_message, document.getElementById(set_metadata_of_message_from_message_ids_array(uncached_message.id, {cached: false}).between_message_ids.newer));
      }
      else {
        break;
      }
    }
  }
  if (message_elements_below_cache.length > 0) {
    for (let i=0;i < 50;i++) { //(DESC) Limit the otherwise infinite loop to 50 iterations.
      if (message_elements_below_cache.length > 0 && chat_wrapper.scrollHeight - (chat_wrapper.clientHeight + chat_wrapper.scrollTop) <= chat_wrapper.clientHeight) {
        //(DESC) User is scrolling to the bottom, we need to pull FIRST message (message_elements_below_cache.pop()) from the message_elements_below_cache array and add it to the end of the chat
        let uncached_message = message_elements_below_cache.pop();
        chat.appendChild(uncached_message);
        set_metadata_of_message_from_message_ids_array(uncached_message.id, {cached: false});
      }
      else {
        break;
      }
    }
  }
}

chat_wrapper.addEventListener("scroll", (ev) => {
  check_chat_elements_above_and_below();
});

//(DESC) Prevent users from pasting anything other than plain-text into the message box
message_box.addEventListener('paste', function (e) {
  // Prevent the default action
  e.preventDefault();

  // Get the copied text from the clipboard
  const text = (e.clipboardData
      ? (e.originalEvent || e).clipboardData.getData('text/plain')
      : // For IE
      window.clipboardData
      ? window.clipboardData.getData('Text')
      : '');

  // Insert text at the current position of caret
  const range = document.getSelection().getRangeAt(0);
  range.deleteContents();
  
  const textNode = document.createTextNode(text);
  range.insertNode(textNode);
  range.selectNodeContents(textNode);
  range.collapse(false);

  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);


  //(DESC) Handle it if it's a file
  if (e.clipboardData) {
    if (e.clipboardData.items) {
      // Use DataTransferItemList interface to access the file(s)
      items = [...e.clipboardData.items];
      image_files = items.filter(({kind, type}) => kind === "file" && (type.startsWith("image/") || type.startsWith("img/")));

      if (image_files.length > 0) {
        image_files.forEach((file, i) => handleImageFileUpload(file.getAsFile(), i))
      }
    } else {
      // Use DataTransfer interface to access the file(s)
      [...e.clipboardData.files].forEach((file, i) => {
        handleImageFileUpload(file, i);
      });
    }
  }
});

//(DESC) Allow the message box to be edited
message_box.setAttribute("contenteditable", "true");

userNotificationSound.load();
systemNotificationSound.load();

typing_users = [];
currently_typing = false;
last_seen_typing = 0;

function sendTo(connection, message) {
  stringified_message = "";
  try {
    stringified_message = JSON.stringify(message);
  } catch (err) {
    console.log("ERROR while stringifying message:", err);
    console.log("Original message:", message);
    return;
  }
  //(NOTE) The following code will only run if there was not an error stringifying the message.
  /*//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////*/
  //(TODO) Check if the connection is alive before sending data 
  if (connection && connection.readyState === connection.OPEN) {
      connection.send(stringified_message);
  }
  else {
    console.log("connection closed or not ready!!");
    if (!['m', 't', 'k'].includes(message[0])) {
      showMessage(new ChatMessage("", system_ChatUser, "ERROR: Connection to server is not ready. Message not sent."));
      if (message.length !== undefined) {
        if (message.length === 0) {
          showMessage(new ChatMessage("", system_ChatUser, `Original Message: ${message[0]}`));
        }
        else if (message.length > 0) {
          showMessage(new ChatMessage("", system_ChatUser, `Original Message: ${message[1]}`));
        }
      }
    }
  }
}


function cross_browser_keycode(event) {
  var code;

  if (event.key !== undefined) {
    code = event.key;
  } else if (event.keyIdentifier !== undefined) {
    code = event.keyIdentifier;
  } else if (event.keyCode !== undefined) {
    code = event.keyCode;
  }

  return code;
};

message_box.addEventListener("keydown", function (event) {
  key_code = cross_browser_keycode(event);
  if ((key_code === 13 || key_code === "Enter" || key_code === "NumpadEnter") && !event.shiftKey) { //(NOTE) Enter
    sendMessageFromBox();
    event.preventDefault();
  }
});
document.addEventListener("keydown", function (event) {
  key_code = cross_browser_keycode(event);
  if (key_code === 27 || key_code === "Escape") { //(NOTE) Escape
    chat.innerHTML = "";
    message_box.innerHTML = ""
    event.preventDefault();
  }
});





























//(DESC) All websocket-related code
if ("WebSocket" in window) {
  var isCalling = false;
  var stream;
  var yourConn;
  var yourConnIceCandidateBuffer = [];

  const commands = {
    "help": "Show this list",
    "nick (nickname)": "Change your nickname",
    "list": "Get a list of all connected users",
    "clear": "Clear messages",
    "history (number of messages)": "Load chat history from logs",
    "fullscreen": "Enter fullscreen mode",
    "link": "Generate a localtunnel link",
    "dark": "Set theme to dark",
    "light": "Set theme to light",
    "call audio (nickname)": "Initiate an audio call with a user",
    "call video (nickname)": "Initiate a video call with a user",
    "call accept": "Accept an incoming call",
    "call cancel": "Cancel an outgoing call",
    "call reject": "Reject an incoming call",
    "call leave": "Leave your current call",
  }

  function getCommandsString() {
    //(DESC) Format and return a string of commands from the commands object.
    parsedCommandsString = "";
    commands_spacing = 10;
    Object.keys(commands).forEach(function(command) {
      command_length = ('/' + command).length;
      if (command_length >= commands_spacing - 5) {
        commands_spacing = (command_length - (command_length % 5)) + 10;
      }
    });

    Object.entries(commands).forEach(function([command, definition]) {
      command_spaces = ' '.repeat(commands_spacing - ('/' + command).length);
      parsedCommandsString += '`/' + command + command_spaces + definition + '`\n';
    });

    //(DESC) Remove trailing whitespace (this would also remove leading whitespace but we don't have that.)
    //(CODE) parsedCommandString = parsedCommandString.trim();
    parsedCommandsString = parsedCommandsString.slice(0, -1);

    return parsedCommandsString;
  }

  //(DESC) Stop both mic and camera
  function stopBothVideoAndAudio(stream) {
    stream.getTracks().forEach(function(track) {
      if (track.readyState == "live") {
        track.stop();
      }
    });
  }

  //(DESC) Stop only camera
  function stopVideoOnly(stream) {
    stream.getTracks().forEach(function(track) {
      if (track.readyState == "live" && track.kind === "video") {
        track.stop();
      }
    });
  }

  //(DESC) Stop only mic
  function stopAudioOnly(stream) {
    stream.getTracks().forEach(function(track) {
      if (track.readyState == "live" && track.kind === "audio") {
        track.stop();
      }
    });
  }

  async function loadMediaElement(source, element) {
    var isPlaying = element.currentTime > 0 && !element.paused && !element.ended && element.readyState > element.HAVE_CURRENT_DATA;

    if (!isPlaying) { //(DESC) The media element is paused
      console.log("(loadMediaElement) The element is paused...");
      try {
        element.srcObject = source;
      } catch (err) {
        console.log("(loadMediaElement) Error while initially loading:", err);
      }
    } else { //(DESC) The media element is loading/playing (not paused)
      console.log("(loadMediaElement) the element is playing...");
      try {
        element.pause();
      } catch (err) {
        console.log("(loadMediaElement) Error while pausing:", err);
      }
      try {
        element.srcObject = source;
      } catch (err) {
        console.log("(loadMediaElement) Error while loading after pausing:", err);
      }
      try {
        await element.play();
      } catch (err) {
        console.log("(loadMediaElement) Error while playing after pausing and loading:", err)
      }
    }
    return true;
  }

  async function loadAndPlayMediaElement(source, element) {
    var isPlaying = element.currentTime > 0 && !element.paused && !element.ended && element.readyState > element.HAVE_CURRENT_DATA;

    if (!isPlaying) { //(DESC) The media element is paused
      console.log("(loadAndPlayMediaElement) The element is paused...");
      try {
        if (source !== false) {
          element.srcObject = source;
        }
        //await sleep(1000);
        await element.play();
      } catch (err) {
        console.log("(loadAndPlayMediaElement) Error while initially playing:", err);
      }
    } else { //(DESC) The media element is loading/playing (not paused)
      console.log("(loadAndPlayMediaElement) the element is playing...");
      try {
        element.pause();
      } catch (err) {
        console.log("(loadAndPlayMediaElement) Error while pausing:", err);
      }
      try {
        if (source !== false) {
          element.srcObject = source;
        }
        await element.play();
      } catch (err) {
        console.log("(loadAndPlayMediaElement) Error while playing after pausing:", err);
      }
    }
    return true;
  }

  function setupRTCPeerConnection() {
    try {
      //using Google public stun servers
      configuration = {
        "iceServers": [{ "urls": ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302", "stun:stun.l.google.com:19302", "stun:stun3.l.google.com:19302", "stun:stun4.l.google.com:19302"] }]
      };

      connection = new RTCPeerConnection(configuration);

      connection.onaddstream = function(e) {
        loadMediaElement(e.stream, callAudioElement);
      };

      connection.onicecandidate = function(event) {
        if (event.candidate) {
          //(DEBUG)(CODE) console.log("Got new ice candidate:", event.candidate);
          sendTo(ws, ['c', "candidate", event.candidate]);
        } else {
          //(DEBUG)(CODE) console.log("Got final candidate!");
        }
      };

      //(TODO) Add a foreach that dumps the ice candidates in yourConnIceCandidateBuffer either here or right after the first offer is sent.

      return connection;
    } catch (err) { console.log(err); return false; };
  }

  async function addInputMediaStreamToRTCPeerConnection(connection) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });

      // setup stream listening 
      await connection.addStream(stream);
    } catch (err) { console.log(err); return false; };
  }



  async function getInputDevices() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });

      //using Google public stun servers
      configuration = {
        "iceServers": [{ "urls": ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302", "stun:stun.l.google.com:19302", "stun:stun3.l.google.com:19302", "stun:stun4.l.google.com:19302"] }]
      };

      yourConn = new RTCPeerConnection(configuration);

      yourConn.onaddstream = function(e) {
        loadMediaElement(e.stream, callAudioElement);
        /*
        if (callAudioElement.paused) { //(DESC) The audio element is paused
            callAudioElement.srcObject = e.stream;
        }
        else { //(DESC) The audio element is loading/playing (not paused)
            callAudioElement.pause();
            callAudioElement.srcObject = e.stream;
            playMediaElement(callAudioElement);
        }
        */
      };

      // setup stream listening 
      yourConn.addStream(stream);

      yourConn.onicecandidate = function(event) {
        if (event.candidate) {
          //(DEBUG)(CODE) console.log("Got new ice candidate:", event.candidate);
          sendTo(ws, ['c', "candidate", event.candidate]);
        } else {
          //(DEBUG)(CODE) console.log("Got final candidate!");
        }
      };

      return yourConn;
    } catch (err) {
      showMessage(new ChatMessage("", system_ChatUser, `ERROR: Error while getting input devices: ${err}`));
      console.log(err); return false 
    }

  }

  //(BIGCHANGE) function showMessage(message_type, author, message, snowflake = false, silent = false, unsafe_html = false) {
  function showMessage(message, silent = false, unsafe_html = false) {
    let scroll_before = chat_wrapper.scrollHeight;
    let scrolled_to_bottom = false;
    if (chat_wrapper.scrollHeight - (chat_wrapper.clientHeight + chat_wrapper.scrollTop) < 3) {
      //(DESC) If they are scrolled to the bottom
      scrolled_to_bottom = true;
    }

    //console.log("message=",message);
    let message_type = "others";
    if (message.author.id === our_ChatUser.id) {
      message_type = "you";
    }
    if (message.author.id === system_ChatUser.id) {
      message_type = "sys";
    }

    /*//(BIGCHANGE) if (!snowflake) {
      timestamp = Date.now();
    }
    else {
      timestamp = Number(BigInt(snowflake) >> 22n);
    }*/
    let timestamp = Number(message.timestamp);

    //(DESC) Message is already logged.
    if (message_ids_array.includes(message.id)) return;

    chat_message_div = document.createElement("div");
    chat_message_div.className = "chat_message";
    /*//(BIGCHANGE) if (snowflake) {
      chat_message_div.id = snowflake;
    }
    else {
      //(TODO)(FIX)(NOTE) THIS GENERATES INVALID IDS!!
      chat_message_div.id = (BigInt(timestamp) << 22n).toString(10);
    }*/
    chat_message_div.id = message.id;
    
    message_header_div = document.createElement("div");
    message_header_div.className = "message_header";

    new_datetime = new Date(timestamp);
    message_timestamp_time = document.createElement("time");
    message_timestamp_time.className = "message_timestamp";
    message_timestamp_time.setAttribute("datetime", new_datetime.toJSON());
    message_timestamp_time.setAttribute("title", new_datetime.toDateString()+' '+new_datetime.toLocaleTimeString());
    message_timestamp_time.textContent = new_datetime.toLocaleTimeString().replace(/:\d{2} /, ' ');
    if (message_timestamp_time.textContent.length == 7) {
      message_timestamp_time.textContent = ' '+message_timestamp_time.textContent;
    }

    username_span = document.createElement("span");
    username_span.className = "username "+message_type;
    //(BIGCHANGE) username_span.textContent = author;
    username_span.textContent = message.author.nickname;
    username_span.innerHTML += "<i>&nbsp</i>";

    message_content_span = document.createElement("span");
    message_content_span.className = "message_content";
    /*//(BIGCHANGE) if (unsafe_html) {
      //(DESC) Parse the message directly as HTML if unsafe_html is true
      message_content_span.innerHTML = message;
    }
    else {
      //(TODO) Redo this
      message_content_span.innerHTML = DOMPurify.sanitize(marked.parseInline(message), { ALLOWED_TAGS: ["del", "em", "strong", 'b', 'u', "code", 'a', "img", "image", "video", "audio", "span"], ALLOWED_ATTR: ["title", "alt", "width", "height", "target", "style", "src", "controls", "type", "href", "onclick", "class"] });
    }
    */
    //(TODO) Redo this
    message_content_span.innerHTML = DOMPurify.sanitize(marked.parseInline(message.content), { ALLOWED_TAGS: ["del", "em", "strong", 'b', 'u', "code", 'a', "img", "image", "video", "audio", "span"], ALLOWED_ATTR: ["title", "alt", "width", "height", "target", "style", "src", "controls", "type", "href", "onclick", "class"] });

    add_newline = true;
    if (message_content_span.children.length > 0) {
      if (message_content_span.children[0].hasAttribute("style")) {
        if (message_content_span.children[0].style.display === "block") {
          add_newline = false;
        }
      }
    }
    if (add_newline) message_content_span.innerHTML += '\n';

    //(DESC) Construct message header
    message_header_div.appendChild(message_timestamp_time);
    message_header_div.appendChild(username_span);

    //(DESC) Construct chat message
    chat_message_div.appendChild(message_header_div);
    chat_message_div.appendChild(message_content_span);

    let added_message = add_message_to_message_ids_array(message.id);
    if (added_message === false) {
      console.log("ERROR: Function add_message_to_message_ids_array failed!!!");
      return false;
    }

    if (added_message.between_message_ids.newer === false && added_message.between_message_ids.older === false) {
      //console.log("uhhh")
    }
    
    if (added_message.between_message_ids.newer === false) {
      //console.log("insert newest")
      //(DESC) This message is the newest (or only) message, add it to the end of the chat and scroll to bottom
      let older_message_metadata = false;
      if (added_message.between_message_ids.older !== false) {
        //console.log("THIS MESSAGE'S OLDER IS NOT EQUAL TO FALSE!!!")
        older_message_metadata = get_metadata_of_message_from_message_ids_array(added_message.between_message_ids.older);
        //console.log("older_message_metadata=",older_message_metadata);
      }

      if (older_message_metadata === false || older_message_metadata?.cached === false) {
        chat.appendChild(chat_message_div);
      }
      else if (older_message_metadata?.cached === "above") {
        add_element_to_above_cache(chat_message_div);
      }
      else if (older_message_metadata?.cached === "below") {
        add_element_to_below_cache(chat_message_div);
      }
      else {
        console.log("ERROR: this SHOULDN'T BE   H A P P E N I N GG  D FAFD");
        console.log("older_message_metadata=",older_message_metadata);
        console.log("added_message=",added_message);
        console.log("added_message.between_message_ids.older=",added_message.between_message_ids.older);
      }
      
      if (scrolled_to_bottom) {
        chat_wrapper.scrollTop = chat_wrapper.scrollHeight;
      }
      //(TODO) Else, show that there is a new message somehow.
    }
    else if (added_message.between_message_ids.older === false) {
      //console.log("insert oldest")
      //(DESC) This message is the oldest message, add it to the beginning of the chat
      let newer_message_metadata = false;
      if (added_message.between_message_ids.newer !== false) { //(NOTE) This should 100% of the time ALWAYS, WITHOUT A DOUBT return true. If this doesn't return true I will burn my dick on a stove.
        //console.log("THIS MESSAGE'S NEWER IS NOT EQUAL TO FALSE!!!")
        newer_message_metadata = get_metadata_of_message_from_message_ids_array(added_message.between_message_ids.newer);
        //console.log("newer_message_metadata=",newer_message_metadata);
      }
      else {
        console.log("ERROR:   :)");
        alert("ERROR:   :)");
      }

      if (newer_message_metadata === false || newer_message_metadata?.cached === false) {
        chat.insertBefore(chat_message_div, document.getElementById(added_message.between_message_ids.newer)); //(CODE) chat.insertBefore(chat_message_div, chat.firstElementChild);
      }
      else if (newer_message_metadata?.cached === "above") {
        add_element_to_above_cache(chat_message_div);
      }
      else if (newer_message_metadata?.cached === "below") {
        add_element_to_below_cache(chat_message_div);
      }
      else {
        console.log("ERROR: this SHOULDN'T BE HAPPENINGNNGGNGASUNDSIFASIFUHAI");
      }
    }
    else {
      //console.log("insert between")
      //console.log("newer = ",added_message.between_message_ids.newer,"older = ",added_message.between_message_ids.older)
      //(DESC) This message is between the oldest message and the newest message.
      let newer_message_metadata = get_metadata_of_message_from_message_ids_array(added_message.between_message_ids.newer);
      if (newer_message_metadata?.cached === false) {
        chat.insertBefore(chat_message_div, document.getElementById(added_message.between_message_ids.newer)); //(CODE) chat.insertBefore(chat_message_div, chat.firstElementChild);
        //(NOTE) If this doesn't work, comment the above and uncomment the below
        //(CODE) document.getElementById(added_message.between_message_ids.older).insertAdjacentElement("afterend", chat_message_div);
      }
      else if (newer_message_metadata?.cached === "above") {
        add_element_to_above_cache(chat_message_div);
      }
      else if (newer_message_metadata?.cached === "below") {
        add_element_to_below_cache(chat_message_div);
      }
      else {
        console.log("ERROR: this SHOULDN'T BE HAPPENINGINGINGINGINGIGINIASENDFOIJSDOIFJ");
        console.log("between newer_message_metadata=",newer_message_metadata);
        console.log("between added_message=",added_message);
        console.log("added_message.between_message_ids.newer=",added_message.between_message_ids.newer);
      }
    }
    
    /*if (message_ids_array.length === 0 || chat_message_div.id > message_ids_array[message_ids_array.length-1]) {
      //(DESC) This message is the newest (or only, that still makes it the newest) message, add it to the end of the array.
      message_ids_array.push(chat_message_div.id);

      //(DESC) Add chat message to the end chat and scroll to bottom
      chat.appendChild(chat_message_div);
      if (scrolled_to_bottom) {
        chat_wrapper.scrollTop = chat_wrapper.scrollHeight;
      }
      //(TODO) Else, show that there is a new message somehow.
    }
    else if (chat_message_div.id < message_ids_array[0]) {
      //(DESC) This message is the oldest message, add it to the beginning of the array.
      message_ids_array.unshift(chat_message_div.id);
      chat.insertBefore(chat_message_div, chat.firstElementChild);
    }
    else {
      //(DESC) This message is between the oldest message and the newest message. Find it's place and insert it there.
      let between_message_ids = [0,0]; //(NOTE) between_message_ids = [after_this_message_id, before_this_message_id];
      for (let i=0;i<message_ids_array.length;i++) {
        if (message_ids_array[i] <= chat_message_div.id && message_ids_array[i+1] >= chat_message_div.id) {
          //(NOTE) chat_message_div.id is between message_ids_array[i] and message_ids_array[i+1]
          message_ids_array.splice(i, 0, chat_message_div.id);
          between_message_ids[0] = message_ids_array[i];
          between_message_ids[1] = message_ids_array[i+1];
          break;
        }
      }
      chat.insertBefore(chat_message_div, document.getElementById(between_message_ids[1].toString()));
    }*/
    let scroll_after = chat_wrapper.scrollHeight;

    if (scrolled_to_bottom) {
      chat_wrapper.scrollTop = chat_wrapper.scrollHeight;
    }
    else if (chat_wrapper.scrollTop < 1 && scroll_before !== scroll_after) {
      chat_wrapper.scrollTop += (scroll_after - scroll_before);
    }

    

    if (!muted && !silent) {
      //(DESC) Play notification noise
      if (message_type === "sys") {
        systemNotificationSound.play().catch(err => console.log("Error when playing system notification sound:",err));
      }
      else if (message_type === "others") {
        userNotificationSound.play().catch(err => console.log("Error when playing user notification sound:",err));
      }
    }

  }


  function connect_to_server(timeout_length_ms) {
    //(NOTE) This links to the websocket proxy
    if (location.protocol === "https:") {
      //ws = new WebSocket("wss://" + window.location.host + "/myws");
      ws = new WebSocket("wss://" + ngrok_link + "/myws");
      ws.onclose = (err) => {console.log("ERROR: Error while connecting to server:",err);
      console.log("Attempting reconnect");
      setTimeout(connect_to_server(timeout_length_ms*2), timeout_length_ms);};
    } else {
      ws = new WebSocket("ws://" + window.location.host + "/myws");
      ws.onclose = (err) => {console.log("ERROR: Error while connecting to server:",err);
      console.log("Attempting reconnect");
      setTimeout(connect_to_server(timeout_length_ms*2), timeout_length_ms);};
    }
    


    ws.onopen = function() {
      console.log("Connected to Server");
      timeout_length_ms = 50;
      if (refresh_token) {
        sendTo(ws, ['r', refresh_token]);
      }
      else {
        sendTo(ws, ['r']);
        //showMessage(new ChatMessage("", system_ChatUser, "Reconnecting to Server..."));
      }

      ws.onmessage = function({ data }) {
        try {
          data = JSON.parse(data);
        } catch (err) {
          console.log("Error while parsing data from server:", err);
          showMessage(new ChatMessage("", system_ChatUser, "ERROR: Error while parsing data from the server:" + err.toString()));
          //systemNotificationSound.play().catch(err => console.log(err));
          return;
        }
        switch (data[0]) {
          case 'r': //(DESC) Refresh token
            refresh_token = data[1];
            break;
          case 'k': //(DESC) Keepalive
            if (keepalive_timeout_id === false) { //(DESC) If keepalive_timeout_id is not false, then the server has tried to start another keepalive (this may happen upon reconnecting) which we should ignore. 
              keepalive_timeout_id = setTimeout(function() { sendTo(ws, ['k']); keepalive_timeout_id=false }, 5000);
            }
            break;
          case '0': //(DESC) Serious error
            showMessage(new ChatMessage("", system_ChatUser, "ERROR: There was a serious error on the server's end."));
            //systemNotificationSound.play().catch(err => console.log(err));
            break;
          case 's': //(DESC) System Message
            let received_message = ChatMessage.from(data[1]);
            received_message.author = system_ChatUser;
            showMessage(received_message)
            //showMessage("sys", "SYSTEM", "contents here", "id here")
            //showMessage("sys", data[1], data[2], data[3]);
            //systemNotificationSound.play().catch(err => console.log(err));
            break;
          case 'y': //(DESC) The server is sending us identifying information, yipee!!
            our_ChatUser = ChatUser.from(data[1]);
            break;
          /*case 'y': //(DESC) Message we sent being returned to us
            showMessage("you", data[1], data[2], data[3]);
            break;
          case 'x': //(DESC) Message is HTML
            showMessage(data[1], data[2], data[3], data[3], true);
            //userNotificationSound.play().catch(err => console.log(err));
            break;*/
          case 'm': //(DESC) All other messages
            showMessage(ChatMessage.from(data[1]));
            //showMessage("others", data[1], data[2], data[3]);
            //userNotificationSound.play().catch(err => console.log(err));
            break;
          case 't':
            //(DESC) Set the user in data[1]'s typing indicator to data[2]
            handleUserTyping(data[1], data[2]);
            break;
          case 'c':
            //(DESC) This is our call opcode, all client-server webrtc communication is done here.
            switch (data[1]) {
              case "call":
                //(DESC) We are being called
                showMessage(new ChatMessage("", system_ChatUser, `${data[2]} is calling you! Type  /call accept  to join or type  /call reject  to decline.`));
                //systemNotificationSound.play().catch(err => console.log(err));
                isCalling = true;
                break;
              case "accept":
                //(DESC) Our call was picked up
                showMessage(new ChatMessage("", system_ChatUser, `${data[2]} accepted your call! Connecting...`));
                //systemNotificationSound.play().catch(err => console.log(err));
    
                //(DONE) Move this!
                //loadAndPlayMediaElement(false, callAudioElement);
                break;
              case "reject":
                //(DESC) Our call was declined
                showMessage(new ChatMessage("", system_ChatUser, `${data[2]} declined your call.`));
                //systemNotificationSound.play().catch(err => console.log(err));
                isCalling = false;
                break;
              case "offer":
                //(async function() {
                if (yourConn == undefined) {
                  //console.log("yep, she's undefined.");
                  //yourConnMaybe = await getInputDevices();
                  yourConnMaybe = setupRTCPeerConnection();
                  if (yourConnMaybe === false) {
                    showMessage(new ChatMessage("", system_ChatUser, "ERROR: Could not get input device stream."));
                    //systemNotificationSound.play().catch(err => console.log(err));
                    message = ['c', "reject"];
                    sendTo(ws, message);
                    return;
                  }
                  //(CODE) else {
                  yourConn = yourConnMaybe;
                  //(CODE) }
                } else if (yourConn.signalingState == "closed") {
                  //yourConnMaybe = await getInputDevices();
                  yourConnMaybe = setupRTCPeerConnection();
                  if (yourConnMaybe === false) {
                    showMessage(new ChatMessage("", system_ChatUser, "ERROR: Could not get input device stream."));
                    //systemNotificationSound.play().catch(err => console.log(err));
                    message = ['c', "reject"];
                    sendTo(ws, message);
                    return;
                  }
                  //(CODE) else {
                  yourConn = yourConnMaybe;
                  //(CODE) }
                }
                //(DESC) We've been sent an offer by the person we've agreed to call
                //create and send an answer to the offer we were sent by the person we agreed to call
                yourConn.setRemoteDescription(new RTCSessionDescription(data[2]))
                  .then(() => addInputMediaStreamToRTCPeerConnection(yourConn))
                  .then(() => yourConn.createAnswer())
                  .then(answer => yourConn.setLocalDescription(answer))
                  .then(() => {
                    sendTo(ws, ['c', "answer", yourConn.localDescription]);
                    showMessage(new ChatMessage("", system_ChatUser, "Call connected! Type  /call leave  to end the call."));
                    //systemNotificationSound.play().catch(err => console.log(err));
    
                    loadAndPlayMediaElement(false, callAudioElement);
                  });
    
                /*
                await yourConn.setRemoteDescription(new RTCSessionDescription(data[2]));
                //create and send an answer to the offer we were sent by the person we agreed to call
                yourConn.createAnswer(function (answer) { 
                    yourConn.setLocalDescription(answer); 
                        
                    sendTo(ws, ['c', "answer", answer]); 
                    showMessage("sys", "SYSTEM", "Call connected! Type  /call leave  to end the call.");
                    //systemNotificationSound.play().catch(err => console.log(err));
                }, function (error) { 
                    alert("Error when creating an answer"); 
                });
                */
                //})();
                break;
              case "answer":
                //(DESC) Mouth to tit and ass to dick, we ship off the final answer to our peer
                yourConn.setRemoteDescription(new RTCSessionDescription(data[2]))
                  .then(() => {
                    showMessage(new ChatMessage("", system_ChatUser, "Call connected! Type  /call leave  to end the call."));
                    //systemNotificationSound.play().catch(err => console.log(err));
                    loadAndPlayMediaElement(false, callAudioElement);
                  });
                break;
              case "candidate":
                //(DESC) We've been sent an IceCandidate from the server (peer -> server -> us)
                if (yourConn != undefined) {
                  //if (yourConn.signalingState != "closed") {
                  yourConn.addIceCandidate(new RTCIceCandidate(data[2]));
                  //}
                } else {
                  console.log("Could not add candidate, yourConn is undefined!!!");
                  yourConnIceCandidateBuffer.push(new RTCIceCandidate(data[2]));
                }
                break;
              case "leave":
                //(DESC) We've been instructed by the server to disconnect from the call.
                //showMessage("sys", "SYSTEM", `Your call with ${data[2]} has ended.`);
                //systemNotificationSound.play().catch(err => console.log(err));
                sendTo(ws, ['c', "leave"]);
                //callAudioElement = document.getElementById("remoteAudio");
                //callAudioElement.src = null; 
                callAudioElement.removeAttribute("src");
                callAudioElement.srcObject = null;
    
                yourConn.close();
                yourConn.onicecandidate = null;
                yourConn.onaddstream = null;
                yourConnIceCandidateBuffer = [];
                //callAudioElement.pause()
                stopBothVideoAndAudio(stream);
                yourConn = undefined;
                stream = undefined;
                isCalling = false;
                break;
              default:
                showMessage(new ChatMessage("", system_ChatUser, `ERROR: ${data[1]} is NOT a valid payload for opcode ${data[0]}`));
                //systemNotificationSound.play().catch(err => console.log(err));
                break;
            }
            break;
          default:
            showMessage(new ChatMessage("", system_ChatUser, "ERROR INVALID OPCODE RECEIVED: "+data[0]));
            //systemNotificationSound.play().catch(err => console.log(err));
        }
      };

      ws.onerror = function(err) {
        showMessage(new ChatMessage("", system_ChatUser, "Socket encountered error: "+ err.message +"Closing socket"));
        //systemNotificationSound.play().catch(err => console.log(err));
        //alert("Socket encountered error: "+ err.message);
        console.error("Socket encountered error: ", err.message, "Closing socket");
        ws.close();
      };
    
      ws.onclose = function(event) {
        //console.log("close event:",event);
        ws = null;
        showMessage(new ChatMessage("", system_ChatUser, "Connection closed... Attempting to reconnect!"));
        setTimeout(connect_to_server(timeout_length_ms*2), timeout_length_ms);
        //systemNotificationSound.play().catch(err => console.log(err));
        //alert("Connection closed... refresh to try again!");
      };
      
      //systemNotificationSound.play().catch(err => console.log(err));
    };
  }

  connect_to_server(0);

  function handleUserTyping(nickname, isTyping) {
    if (isTyping) {
      if (typing_users.indexOf(nickname) == -1) {
        typing_users.push(nickname);
      }
      update_is_typing_box();
    } else {
      var index_of_user_to_remove = typing_users.indexOf(nickname);
      if (index_of_user_to_remove > -1) {
        typing_users.splice(index_of_user_to_remove, 1);
      }
      update_is_typing_box();
    }
  }

  function update_is_typing_box() {
    if (typing_users.length == 0) {
      is_typing_box.innerHTML = "";
    }
    if (typing_users.length == 1) {
      is_typing_box.innerHTML = `<b>${typing_users[0]}</b> is typing...`;
    } else {
      var is_typing_box_new_content = "";
      for (i = 0; i < typing_users.length; i++) {
        is_typing_box_new_content += `<b>${typing_users[i]}</b>`;
        if (i + 2 == typing_users.length) {
          is_typing_box_new_content += " and ";
        } else if (i + 1 == typing_users.length) {
          is_typing_box_new_content += " are typing...";
        } else {
          is_typing_box_new_content += ", ";
        }
      }
      is_typing_box.innerHTML = is_typing_box_new_content;
    }
  }

  function parseCommand(string) {
    command = string.slice(1);
    if (command.length < 1) {
      showMessage(new ChatMessage("", system_ChatUser, "Cannot parse an empty command!"));
      //systemNotificationSound.play().catch(err => console.log(err));
      return false;
    }

    args = command.split(' ').filter(arg => arg !== "" && arg !== " ");

    switch (args[0].toLowerCase()) {
      case "help":
        //showMessage("sys", "SYSTEM", `Commands:\n/help                         Show this list\n/list                         Get a list of all connected users\n/nick (nickname)              Change your nickname\n/call audio (nickname)        Initiate an audio call with a user\n/call video (nickname)        Initiate a video call with a user\n/call accept                  Accept an incoming call\n/call cancel                  Cancel an outgoing call\n/call reject                  Reject an incoming call\n/call leave                   Leave your current call\n`);
        showMessage(new ChatMessage("", system_ChatUser, "**Commands:**\n" + getCommandsString()));
        //systemNotificationSound.play().catch(err => console.log(err));
        return false;
        break;
      case "nick":
        //showMessage("sys", "SYSTEM", "This command is not yet ready.");
        //systemNotificationSound.play().catch(err => console.log(err));
        //return false;
        if (args.length < 2) {
          showMessage(new ChatMessage("", system_ChatUser, "This command must have at least one argument. Type /help for a list of commands."));
          //systemNotificationSound.play().catch(err => console.log(err));
          return false;
        }
        message = ['n', args.slice(1).join(' ')];
        return message;
        break;
      case "list":
        message = ['l'];
        return message;
        break;
      case "clear":
        chat.innerHTML = "";
        message_box.innerHTML = "";
        return false;
        break;
      case "history":
        message = ['h', args[1], message_ids_array[0]];
        return message;
        break;
      case "fullscreen":
        var elem = document.documentElement;

        /* View in fullscreen */
        function openFullscreen() {
          if (elem.requestFullscreen) {
            elem.requestFullscreen();
          } else if (elem.webkitRequestFullscreen) { /* Safari */
            elem.webkitRequestFullscreen();
          } else if (elem.msRequestFullscreen) { /* IE11 */
            elem.msRequestFullscreen();
          }
        }

        /* Close fullscreen */
        function closeFullscreen() {
          if (document.exitFullscreen) {
            document.exitFullscreen();
          } else if (document.webkitExitFullscreen) { /* Safari */
            document.webkitExitFullscreen();
          } else if (document.msExitFullscreen) { /* IE11 */
            document.msExitFullscreen();
          }
        }
        if (inFullscreen) {
          closeFullscreen();
        } 
        else {
          openFullscreen();
        }
        inFullscreen = !inFullscreen;
        return false;
        break;
      case "link":
        message = ['u'];
        return message;
        break;
      case "dark":
        //(DESC) Set theme to dark
        //document.styleSheets[1].disabled = true;
        //document.styleSheets[2].disabled = false;
        var theme = document.getElementById("theme");
        if (theme.getAttribute("href") !== "assets/css/darkmode.css") {
          theme.setAttribute("href", "assets/css/darkmode.css");
          showMessage(new ChatMessage("", system_ChatUser, "Theme set to dark"));
        } else {
          showMessage(new ChatMessage("", system_ChatUser, "Theme is already set to dark"));
        }
        //systemNotificationSound.play().catch(err => console.log(err));
        return false;
        break;
      case "light":
        //(DESC) Set theme to light
        //document.styleSheets[1].disabled = false;
        //document.styleSheets[2].disabled = true;
        var theme = document.getElementById("theme");
        if (theme.getAttribute("href") !== "assets/css/lightmode.css") {
          theme.setAttribute("href", "assets/css/lightmode.css");
          showMessage(new ChatMessage("", system_ChatUser, "Theme set to light"));
        } else {
          showMessage(new ChatMessage("", system_ChatUser, "Theme is already set to light"));
        }
        //systemNotificationSound.play().catch(err => console.log(err));
        return false;
        break;
      case "call":
        if (args.length < 2) {
          showMessage(new ChatMessage("", system_ChatUser, "This command must have at least one argument. Type /help for a list of commands."));
          //systemNotificationSound.play().catch(err => console.log(err));
          return false;
        } else if (args[1] == "" || args[1] == ' ') {
          showMessage(new ChatMessage("", system_ChatUser, "This command must have at least one argument. Type /help for a list of commands."));
          //systemNotificationSound.play().catch(err => console.log(err));
          return false;
        } else {
          switch (args[1].toLowerCase()) {
            case "audio":
              if (args.length < 3) {
                showMessage(new ChatMessage("", system_ChatUser, "You must enter a nickname to call someone. Type /help for a list of commands."));
                //systemNotificationSound.play().catch(err => console.log(err));
                return false;
              } else {
                if (args[2] == "" || args[2] == ' ') {
                  showMessage(new ChatMessage("", system_ChatUser, "You must enter a nickname to call someone. Type /help for a list of commands."));
                  //systemNotificationSound.play().catch(err => console.log(err));
                  return false;
                }
              }
              message = ['c', "call", args.slice(2).join(' ').trim()]; //(NOTE) ["call", "audio", "not", "my", "dad", "lmao"].slice(2).join(' ').trim() == "not my dad lmao"
              isCalling = true;
              return message;
              break;
            case "video":
              showMessage(new ChatMessage("", system_ChatUser, "Video calls are not yet supported. Audio calls are though!"));
              //systemNotificationSound.play().catch(err => console.log(err));
              return false;
              break;
            case "accept":
              //(TODO) Create offer and send it to the server along with the accept message
              // create and send an offer back to our caller
              if (isCalling) {
                (async function() {
                  if (yourConn == undefined) {
                    yourConnMaybe = await getInputDevices();
                    //yourConnMaybe = setupRTCPeerConnection(yourConn);
                    if (yourConnMaybe === false) {
                      showMessage(new ChatMessage("", system_ChatUser, "ERROR: Could not get input device stream."));
                      //systemNotificationSound.play().catch(err => console.log(err));
                      message = ['c', "reject"];
                      sendTo(ws, message);
                      return;
                    }
                    //(CODE) else {
                    yourConn = yourConnMaybe;
                    //(CODE) }
                  } else if (yourConn.signalingState == "closed") {
                    yourConnMaybe = await getInputDevices();
                    //yourConnMaybe = setupRTCPeerConnection(yourConn);
                    if (yourConnMaybe === false) {
                      showMessage(new ChatMessage("", system_ChatUser, "ERROR: Could not get input device stream."));
                      //systemNotificationSound.play().catch(err => console.log(err));
                      message = ['c', "reject"];
                      sendTo(ws, message);
                      return;
                    }
                    //(CODE) else {
                    yourConn = yourConnMaybe;
                    //(CODE) }
                  }

                  errorHappened = false;
                  await yourConn.createOffer(async function(offer) {
                      await yourConn.setLocalDescription(offer);
                      sendTo(ws, ['c', "offer", offer]);
                    },
                    function(error) {
                      console.log(error);
                      showMessage(new ChatMessage("", system_ChatUser, "ERROR: Error when creating an offer."));
                      //systemNotificationSound.play().catch(err => console.log(err));
                      //alert("Error when creating an offer");
                      errorHappened = true;
                    });
                  if (errorHappened) {
                    message = ['c', "reject"];
                  } else {
                    message = ['c', "accept"];
                  }
                  sendTo(ws, message);
                  //return message;
                })();
                return false; //(NOTE) We return false here because async hek.
              } else {
                showMessage(new ChatMessage("", system_ChatUser, "You cannot accept a call if you aren't being called."));
                //systemNotificationSound.play().catch(err => console.log(err));
                return false;
              }
              break;
            case "reject":
              if (isCalling) {
                message = ['c', "reject"];
                isCalling = false
                return message;
              } else {
                showMessage(new ChatMessage("", system_ChatUser, "You cannot reject a call if you aren't being called."));
                //systemNotificationSound.play().catch(err => console.log(err));
                return false;
              }
              break;
            case "cancel":
              showMessage(new ChatMessage("", system_ChatUser, "This subcommand is not ready yet (sorry!)"));
              //systemNotificationSound.play().catch(err => console.log(err));
              isCalling = false
              return false;
              break;
            case "leave":
              if (yourConn != undefined) {
                if (yourConn.signalingState != "closed") {
                  //(CODE) if (isCalling) {
                  message = ['c', "leave"];
                  //callAudioElement.src = null; 
                  callAudioElement.removeAttribute("src");
                  callAudioElement.srcObject = null;

                  yourConn.close();
                  yourConn.onicecandidate = null;
                  yourConn.onaddstream = null;
                  //callAudioElement.pause()
                  stopBothVideoAndAudio(stream);
                  yourConn = undefined;
                  stream = undefined
                  isCalling = false
                  return message;
                  //(CODE) }
                }
              }
              //(CODE) else {
              showMessage(new ChatMessage("", system_ChatUser, "You cannot leave a call that you are not in."));
              //systemNotificationSound.play().catch(err => console.log(err));
              return false;
              //(CODE) }
              break;
            default:
              showMessage(new ChatMessage("", system_ChatUser, `Unknown subcommand: "${args[1]}". Type /help for a list of commands.`));
              //systemNotificationSound.play().catch(err => console.log(err));
              return false;
          }
        }
        break;
      default:
        showMessage(new ChatMessage("", system_ChatUser, `Unknown command: "${args[0]}". Type /help for a list of commands.`));
        //systemNotificationSound.play().catch(err => console.log(err));
        return false;
    }
  }

  function sendMessageFromBox() {
    if (ws) {
      if (message_box.textContent.startsWith('/')) {
        message = parseCommand(message_box.textContent);
        if (!(message === false)) {
          sendTo(ws, message);
        }
        message_box.textContent = "";
        currently_typing = false;
      } else {
        if (message_box.innerHTML.trim().length > 0) {
          sendTo(ws, ['m', new ChatMessage("", our_ChatUser, message_box.textContent.trim())]);
          message_box.textContent = "";
          currently_typing = false;
        }
      }
    } else {
      console.log("Not connected, cannot send message from box ;-;");
      currently_typing = false;
      typing_users = [];
      update_is_typing_box();
      //showMessage(new ChatMessage("", system_ChatUser, "ERROR: Not connected... refresh to try again!"));
      //systemNotificationSound.play().catch(err => console.log(err));
      //alert("ERROR: Not connected... refresh to try again!");
    }
  }
  sendBtn.onclick = sendMessageFromBox;
  wipeBtn.onclick = function() { chat.innerHTML = "";message_box.innerHTML = "" };
  message_box.oninput = function() {
    if (currently_typing === false) {
      currently_typing = true;
      last_seen_typing = Date.now();
      if (ws) {
        sendTo(ws, ['t']);
      } else {
        console.log("Not connected, cannot send typing info ;-;");
        currently_typing = false;
        typing_users = [];
        update_is_typing_box();
        //showMessage(new ChatMessage("", system_ChatUser, "ERROR: Not connected... refresh to try again!"));
        //systemNotificationSound.play().catch(err => console.log(err));
        //alert("ERROR: Not connected... refresh to try again!");
      }
    } else {
      //(DESC) If last_seen_typing happened over 1.5s (1500ms) ago, send another typing indicator to the server
      if (Date.now() - last_seen_typing > 1500) {
        if (ws) {
          sendTo(ws, ['t']);
          last_seen_typing = Date.now();
        } else {
          console.log("Not connected, cannot send typing info ;-;");
          currently_typing = false;
          typing_users = [];
          update_is_typing_box();
          //showMessage(new ChatMessage("", system_ChatUser, "ERROR: Not connected... refresh to try again!"));
          //systemNotificationSound.play().catch(err => console.log(err));
          //alert("ERROR: Not connected... refresh to try again!");
        }
      }
    }
  };
















} else {
  showMessage(new ChatMessage("", system_ChatUser, "WebSocket NOT supported by your Browser!"));
  //systemNotificationSound.play().catch(err => console.log(err));
  alert("WebSocket NOT supported by your Browser!");
}







































//(DESC) FILE HANDLING
var dropZone = document.getElementById('dropzone');

function showDropZone() {
	dropZone.style.display = "block";
}
function hideDropZone() {
  dropZone.style.display = "none";
}

function allowDrag(ev) {
  if (true) {  // Test that the item being dragged is a valid one
    ev.dataTransfer.dropEffect = 'copy';
    ev.preventDefault();
  }
}

// Convert file to base64 string
const fileToBase64 = (file) => {
  return new Promise(resolve => {
    var reader = new FileReader();
    // Read file content on file loaded event
    reader.onload = function(event) {
      resolve(event.target.result);
    };
    
    // Convert data to base64 
    reader.readAsDataURL(file);
    
  });
};

function handleImageFileUpload(file, fileIndex) {
  //(DEBUG)(CODE) console.log(`… file[${fileIndex}].name = ${file.name}`);
  //(DEBUG)(CODE) console.log(`… file[${fileIndex}].size = ${file.size}`);
  if (file.size < 32000000) {
    fileToBase64(file).then(result => {
      const base64String = result.replace("data:", '').replace(/^.+,/, '');
      showMessage(new ChatMessage("", system_ChatUser, `Uploading file ${fileIndex+1}...`));
      systemNotificationSound.play().catch(err => console.log(err));
      //(DEBUG)(CODE) console.log(result.length);
      //(DESC) Send file to server for upload
      sendTo(ws, ['i', "file", base64String]);
    });
  }
  else {
    showMessage(new ChatMessage("", system_ChatUser, "File upload error: File must be smaller than 32MB."));
    return;
  }
}

function handleImageURLUpload(url, urlIndex) {
  //(DEBUG)(CODE) console.log(`… url[${urlIndex}] = ${url}`);
  showMessage(new ChatMessage("", system_ChatUser, `Uploading file ${urlIndex+1}...`));
  systemNotificationSound.play().catch(err => console.log(err));
  //(DESC) Send file to server for upload
  sendTo(ws, ['i', 'url', url]);
}


function dropHandler(ev) {
  //(DEBUG)(CODE) console.log("File(s) dropped");

  // Prevent default behavior (Prevent file from being opened)
  ev.preventDefault();
  hideDropZone();

  if (ev.dataTransfer.items) {
    // Use DataTransferItemList interface to access the file(s)
    items = [...ev.dataTransfer.items];
    image_files = items.filter(({kind, type}) => kind === "file" && (type.startsWith("image/") || type.startsWith("img/")));

    if (image_files.length > 0) {
      image_files.forEach((file, i) => handleImageFileUpload(file.getAsFile(), i))
    }
    else {
      image_htmls = items.filter(({kind, type}) => kind === "string" && type === "text/html");
      if (image_htmls.length > 0) {
        image_htmls.forEach((string, i) => {
          string.getAsString(string => {
            extracted_hrefs = string.match(/(href="https*:\/\/){1}[^ "\n]*(\.[A-Za-z0-9]+")/gi);
            if (extracted_hrefs) {
              extracted_hrefs.forEach(string => {
                extracted_url = string.slice(6,-1);
                handleImageURLUpload(extracted_url, i);
              })
            }
          });
        });
        
      }
    }

    /*
    for (i=0;i<items.length;i++) {
      item = items[i];
      console.log("item:",item);
      // If dropped items aren't files, reject them
      if (item.kind === 'file' && (item.type.startsWith('image/') || item.type.startsWith('img/'))) {
        const file = item.getAsFile();
        console.log("file:",file);
        handleFileUpload(file, i);
      }
      else {
        item.getAsString((string) => {console.log(`${item.type}:`,string);});
      }
    
    }*/
  } else {
    // Use DataTransfer interface to access the file(s)
    [...ev.dataTransfer.files].forEach((file, i) => {
      handleImageFileUpload(file, i);
    });
  }
}

// 1
window.addEventListener('dragenter', function(e) {
  showDropZone();
});

// 2
dropZone.addEventListener('dragenter', allowDrag);
dropZone.addEventListener('dragover', allowDrag);

// 3
dropZone.addEventListener('dragleave', function(ev) {
	//(DEBUG)(CODE) console.log('dragleave');
  hideDropZone();
});

// 4
dropZone.addEventListener('drop', dropHandler);


