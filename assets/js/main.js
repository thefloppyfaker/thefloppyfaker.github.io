//(DESC) Posts json data to a url and returns the response
async function submit_data(url, data) {
  response = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  return await response.json();
}

screenLock = null;
navigator.wakeLock.request('screen').then(lock => screenLock = lock).catch(err => console.log(err.name, err.message));

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

/*
//(DESC) self_destructing_element_event_listeners = {element: [{eventType: string, handler: function}, {eventType: string, handler: function}, etc], etc}
const self_destructing_element_event_listeners = {};

removeAllSelfDestructingEventListeners = (element) => {
  delete self_destructing_element_event_listeners[element];
}

addSelfDestructingEventListener = (element, eventType, callback) => {
  let handler = (ev) => {
    element.removeEventListener(eventType, handler);
    if (self_destructing_element_event_listeners.hasOwnProperty(element)) {
      if (self_destructing_element_event_listeners.find(eventListener_object => eventListener_object.handler === handler)) {
        callback(ev);
      }
    }
  };

  element.addEventListener(eventType, handler);
  if (self_destructing_element_event_listeners.hasOwnProperty(element)) 
    self_destructing_element_event_listeners[element].push({eventType: eventType, handler: handler});
  else 
    self_destructing_element_event_listeners[element] = [{eventType: eventType, handler: handler}];
};
*/
addSelfDestructingEventListener = (element, eventType, callback) => {
  let handler = (ev) => {
    if (callback(ev)) {
      element.removeEventListener(eventType, handler);
    }
  };
  element.addEventListener(eventType, handler);
};

function getDomain(url, subdomain) {
  subdomain = subdomain || false;

  //url = url.replace(/(https?:\/\/)?(www\.)?/i, '');
  url = url.replace(/([a-z]*:\/\/)?(www\.)?/i, '');

  if (!subdomain) {
    url = url.split('.');

    url = url.slice(url.length - 2).join('.');
  }

  if (url.indexOf('/') !== -1) {
    return url.split('/')[0];
  }

  return url;
}

function fallbackCopyTextToClipboard(text) {
  var textArea = document.createElement("textarea");
  textArea.value = text;
  
  // Avoid scrolling to bottom
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.position = "fixed";

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    var successful = document.execCommand('copy');
    var msg = successful ? 'successful' : 'unsuccessful';
    console.log('Fallback: Copying text command was ' + msg);
  } catch (err) {
    console.error('Fallback: Oops, unable to copy', err);
  }

  document.body.removeChild(textArea);
}
function copyTextToClipboard(text) {
  if (!navigator.clipboard) {
    fallbackCopyTextToClipboard(text);
    return;
  }
  navigator.clipboard.writeText(text).then(function() {
    console.log('Async: Copying to clipboard was successful!');
  }, function(err) {
    console.error('Async: Could not copy text: ', err);
  });
}





//(DESC) Preload what needs to be preloaded, then run everything else.
async function preload_data() {
  const preloaded = {};

  //(DESC) Fetch config
  preloaded.config = await (await fetch("assets/data/web_config.json")).json();

  //(DESC) Fetch and define emoji table
  preloaded.emoji_definitions = await (await fetch("assets/data/emoji_definitions.json")).json();

  //(DESC) Check if there is a token in localstorage
  if (localStorage.getItem("token")) {
    let domain = getDomain(location.host);
    let auth_url_properties = {
      protocol: location.protocol,
      host: domain,
      path: "/auth",
    }
    if (preloaded.config.supported_external_domains.includes(domain)) {
      auth_url_properties.host = preloaded.config.ngrok_url;
    }
    let auth_url = `${auth_url_properties.protocol}//${auth_url_properties.host}${auth_url_properties.path}`;

    let server_response = await submit_data(`${auth_url}/token`, {token: localStorage.getItem("token")});
    if (server_response.hasOwnProperty("error")) {
      //(DESC) Server sent us an error (token is probably invalid). Go back to the login page.
      location.replace(`${location.protocol}//${location.host}/login`);
      return; //(NOTE) Should never be run
    }

    preloaded.our_ChatUser = server_response.user;
  } else {
    //(DESC) There isn't a login token in localStorage. Go back to the login page.
    location.replace(`${location.protocol}//${location.host}/login`);
    return; //(NOTE) Should never be run
  }
  return preloaded;
};

preload_data().then((preloaded) => {
if (!preloaded) return; //(NOTE) This is just here to stop the function if it's running ahead of the above location.replace

//(DESC) Element defines from the webpage
const chat = document.getElementById("chat");
const is_typing_box = document.getElementById("is_typing_box");
const bottom_message_box = document.getElementById("bottom_message_box");
const wipeBtn = document.getElementById("wipe");
const uploadBtn = document.getElementById("upload");
const sendBtn = document.getElementById("send");
const callAudioElement = document.getElementById("remoteAudio");
const userNotificationSound = document.getElementById("userNotificationSound");
const systemNotificationSound = document.getElementById("systemNotificationSound");
const theme = document.getElementById("theme");
//const jinglingSound = document.getElementById("jinglingSound");
//jinglingSound.fadingIn = false;
//jinglingSound.fadingOut = false;



/** A pretty cool interface for the web audio api */
class PrettyCoolAudio {
  #actx;
  src;
  #audioData;
  #srcNode;
  #gainNode;
  #currentState; //(DESC) "unloaded" | "stopped" | "paused" | "playing" | "closed"
  #options;

  default_options = {
    volume: 0,
    loop: false,
    fadeIn: false,
    fadeOut: false,
  };

  /**
   * Create a new PrettyCoolAudio interface.
   * @param {string | ArrayBuffer} [src] - The audio source 
   * @param {Object} [options] - Options
   * @param {number} [options.volume] - The desired volume of the audio
   * @param {boolean} [options.loop] - Loop this audio automatically
   * @param {boolean} [options.fadeIn] - Fade the audio in when starting
   * @param {boolean} [options.fadeOut] - Fade the audio out when ending
   */
  constructor(src = "", options) {
    let defaults = {
      volume: 0,
      loop: false,
      fadeIn: false,
      fadeOut: false,
    };
    this.src = src;
    /** @private {AudioContext} The audio context */
    this.#actx = new (AudioContext || webkitAudioContext)();
    /** @private {AudioBuffer} The decoded audio data for the LOADED source */
    this.#audioData = null;
    /** @private {AudioBufferSourceNode} The audio context */
    this.#srcNode = null;
    /** @private {GainNode} The audio context */
    this.#gainNode = null;
    /** @private {string} The current audio state. Can be "unloaded" | "stopped" | "stopping" | "paused" | "pausing" | "playing" | "closed" | "closing" */
    this.#currentState = "unloaded";
    /** @private {Object} Options */
    this.#options = { ...defaults, ...options};
  }

  get currentState() {return this.#currentState}
  get isLoaded() {return (this.currentState !== "unloaded" && this.currentState !== "closed")}
  get isStopped() {return (this.currentState === "stopped")}
  get isStopping() {return (this.currentState === "stopping")}
  get isPaused() {return (this.currentState === "paused")}
  get isPausing() {return (this.currentState === "pausing")}
  get isPlaying() {return (this.currentState === "playing")}
  get isClosed() {return (this.currentState === "closed")}
  get isClosing() {return (this.currentState === "closing")}
  get volume() {return this.#options.volume}
  get currentTime() {return this.#actx.currentTime}

  isValidNumber(number, range={min: false, max: false}) {
    if (typeof number !== "number" || isNaN(number)) {
      console.log("number must be a number!!!");
      //(DEBUG)(CODE) if (typeof number !== "number") console.log(`number is typeof ${typeof number}`);
      //(DEBUG)(CODE) else if (isNaN(number)) console.log("number is NaN");
      return false;
    }
    if (range.hasOwnProperty("min") && range.hasOwnProperty("max")) { 
      //(NOTE) This entire statement is unnecessary, remove it if you want. 
      if (range.min !== false && range.min !== null && range.min !== undefined && range.max !== false && range.max !== null && range.max !== undefined) {
        if (number < range.min || number > range.max) {
          //(DEBUG)(CODE) console.log(`number must be a value between ${range.min} and ${range.max}`);
          return false;
        }
      }
    }
    if (range.hasOwnProperty("min")) {
      if (range.min !== false && range.min !== null && range.min !== undefined) {
        if (number < range.min) {
          //(DEBUG)(CODE) console.log(`number must be a value greater than ${range.min}`);
          return false;
        }
      }
    }
    if (range.hasOwnProperty("max")) {
      if (range.max !== false && range.max !== null && range.max !== undefined) {
        if (number > range.max) {
          //(DEBUG)(CODE) console.log(`number must be a value less than ${range.max}`);
          return false;
        }
      }
    }
    //(NOTE) If none of the above occured (they all return false), then the number is valid.
    return true;
  }

  isValidVolume(volume) {
    return this.isValidNumber(volume, {min: 0, max: 1});
  }

  setOptions(new_options={volume: 0, loop: false, fadeIn: false, fadeOut: false}) {
    if (Object.keys(new_options).some(key => (!this.#options.hasOwnProperty(key)))) {
      //(DESC) new_options has a key that is not in options
      console.log("ERROR: Cannot set options: An option has an invalid key!!");
      return false;
    }
    if (Object.keys(new_options).some(key => (typeof this.#options[key] !== typeof new_options[key]))) {
      //(DESC) new_options and this.#options both have a key value pair with the same key name, but with different value types.
      console.log("ERROR: Cannot set options: An option has an invalid type!!");
      return false;
    }
    //(NOTE) All options are valid

    Object.entries(new_options).forEach(([key, new_value]) => {
      if (key === "volume") {
        this.setVolume(new_value);
        return;
      }
      else if (key === "loop") {
        if (this.#srcNode) {
          this.#srcNode.loop = new_value;
        }
      }
      this.#options[key] = new_value;
    });
    return true;
    //return changed_options;
  }

  /** 
   * instantly changes the volume
   * @param {number} volume - A number between 0 and 1 to set the volume to
   */
  setVolume(volume, change_volume_option=true) {
    if (!this.isValidVolume(volume)) {
      console.log("ERROR: Cannot set volume: volume is invalid!!");
      return false;
    }
    //(NOTE) Volume is valid
    //(DESC) the web audio api *really* doesn't like a volume of zero, so set it to Number.EPSILON (the smallest non-zero value that javascript can store)
    if (volume === 0) volume = Number.EPSILON;

    if (this.#gainNode) {
      this.#gainNode.gain.setValueAtTime(volume, this.currentTime);
      //this.#gainNode.gain.value = volume;
    }

    if (change_volume_option) {
      if (volume === Number.EPSILON) this.#options.volume = 0;
      else this.#options.volume = volume;
    }
    return true;
  }

  /** 
   * Fade the volume over time
   * @param {number} length_seconds - The amount of time to fade the volume over
   * @param {number} desired_volume - The volume to fade to (between 0 and 1)
   */
  fadeTo(length_seconds, desired_volume, change_volume_option=true) {
    if (!this.isValidNumber(length_seconds, {min: 0})) {
      console.log("ERROR: Cannot fadeTo volume: length_seconds is invalid!!!");
      return false;
    }
    if (!this.isValidVolume(desired_volume)) {
      console.log("ERROR: Cannot fadeTo volume: desired_volume is invalid!!!");
      return false;
    }
    //(NOTE) length_seconds and desired_volume are vaild

    if (!this.isLoaded) {
      console.log("ERROR: Cannot fadeTo volume: No audio is loaded!!!");
      return false;
    }
    if (!this.#gainNode) {
      console.log("ERROR: Cannot fadeTo volume: No gainNode connected!!!");
      return false;
    }
    //(NOTE) All prerequisites have been met

    //(DESC) the web audio api *really* doesn't like a volume of zero, so set it to Number.EPSILON (the smallest non-zero value that javascript can store)
    if (desired_volume === 0) desired_volume = Number.EPSILON;

    //this.#gainNode.gain.setValueAtTime(this.volume, this.currentTime);
    this.#gainNode.gain.linearRampToValueAtTime(desired_volume, this.currentTime + length_seconds);

    if (change_volume_option) {
      if (desired_volume === Number.EPSILON) this.#options.volume = 0;
      else this.#options.volume = desired_volume;
    }
    return true;
  }

  async load_from_buffer(buffer) {
    if (this.isClosed || this.isClosing) {console.log("Cannot load, audio is closed or closing");return false}
    this.#audioData = await this.#actx.decodeAudioData(buffer);
    if (this.isPaused || this.isPausing || this.isPlaying) {
      if (this.#srcNode) {
        this.#srcNode.stop();
        this.#srcNode = null;
      }
    }
    this.#currentState = "stopped";
    return this.#audioData;
  }

  async load_from_url(url) {
    if (this.isClosed || this.isClosing) {console.log("Cannot load, audio is closed or closing");return false}
    let response = await fetch(url, {mode: "cors"});
    let buffer = await response.arrayBuffer();
    return await this.load_from_buffer(buffer);
  }

  async load() {
    if (this.isClosed || this.isClosing) {console.log("Cannot load, audio is closed or closing");return false}
    if (this.src instanceof ArrayBuffer) return await this.load_from_buffer(this.src);
    if (typeof this.src === "string") return await this.load_from_url(this.src);
    else console.log("ERROR: SRC MUST BE OF STRING OR INSTANCE OF ArrayBuffer!!!");
    return false;
  }

  async play() {
    if (this.isClosed || this.isClosing) {console.log("Cannot play, audio is closed or closing");return false}

    switch (this.currentState) {
      case "unloaded":
        console.log("Aborting play due to no audio being loaded");
        return false;
      case "playing":
        console.log("Aborting play due to currentState being set to \"playing\"");
        return false;
      case "pausing":
        console.log("Audio is pausing. Playing..");
        if (this.#options.fadeIn) this.fadeTo(5, this.#options.volume);
        else this.setVolume(this.#options.volume);
        this.#currentState = "playing";
        return true;
      case "paused":
        console.log("Audio is paused, resuming..");
        //this.setVolume(0, false);
        await this.#actx.resume();
        if (this.#options.fadeIn) this.fadeTo(5, this.#options.volume);
        else this.setVolume(this.#options.volume);
        this.#currentState = "playing";
        return true;
    }
    
    if (this.#actx.state === "suspended") {
      //(DESC) AudioContext is suspended, *try* to resume it
      try {
        //let volume = this.#options.volume;
        //this.setVolume(0);
        await this.#actx.resume();
        //if (this.#options.fadeIn) this.fadeTo(5, volume);
        //else this.setVolume(volume);
      }
      catch(err) {
        console.log("ERROR: Unable to resume audio context. Error:",err);
        return false;
      }
    }

    this.#gainNode = this.#actx.createGain();
    this.#gainNode.connect(this.#actx.destination);
    
    this.#srcNode = this.#actx.createBufferSource();    // create audio source
    this.#srcNode.connect(this.#gainNode);              // create output

    this.#srcNode.buffer = this.#audioData;             // use decoded buffer
    this.#srcNode.loop = this.#options.loop;            // takes care of perfect looping

    this.setVolume(0, false);

    

    this.#srcNode.start();                              // play...
    if (this.#options.fadeIn) this.fadeTo(5, this.#options.volume);
    else this.setVolume(this.#options.volume);
    this.#currentState = "playing";
    return true;
  }

  async pause() {
    if (this.isClosed || this.isClosing) {console.log("Cannot pause, audio is closed or closing");return false}
    if (!this.isPlaying) {
      console.log("Aborting pause due to currentState not being set to \"playing\"");
      return false;
    }
    if (this.#options.fadeOut && !this.isPausing) { //(NOTE) if we're in the pausing state, assume that we're being forced to pause and pause immediately 
      this.#currentState = "pausing";
      this.fadeTo(5, 0, false);
      setTimeout(async () => {
        if (this.isPausing) { //(DESC) Only pause if we're still in the pausing state
          await this.#actx.suspend();
          this.#currentState = "paused"
        }
      }, 5.1*1000);
    }
    else {
      this.setVolume(0, false);
      await this.#actx.suspend();
      this.#currentState = "paused";
    }
    return true;
  }

  async stop() {
    if (this.isClosed || this.isClosing) {console.log("Cannot stop, audio is closed or closing");return false}
    if (this.isStopped) {
      console.log("Aborting stop due to currentState being set to \"stopped\"");
      return true;
    }
    if (this.#options.fadeOut && this.volume > 0 && !this.isStopping) { //(NOTE) if we're in the stopping state, assume that we're being forced to stop and stop immediately 
      this.fadeTo(5, 0, false);
      this.#currentState = "stopping";
      setTimeout(async () => {
        if (this.isStopping) { //(DESC) Only stop if we're still in the stopping state
          if (this.#srcNode) await this.#srcNode.stop();
          this.#srcNode = null;
          this.#gainNode = null;
          this.#currentState = "stopped";
        }
      }, 5.1*1000);
    }
    else {
      this.setVolume(0, false);
      if (this.#srcNode) await this.#srcNode.stop();
      this.#srcNode = null;
      this.#gainNode = null;
      this.#currentState = "stopped";
    }
    return true;
  }
  
  async close() {
    if (this.isClosed) {
      console.log("Aborting close due to currentState being set to \"closed\"");
      return true;
    }
    if (this.#options.fadeOut && this.volume > 0 && !this.isClosing) { //(NOTE) if we're in the closing state, assume that we're being forced to close and close immediately 
      this.#currentState = "closing";
      this.fadeTo(5, 0);
      setTimeout(async () => {
        if (this.isClosing) { //(DESC) Only close if we're still in the closing state
          if (this.#srcNode) await this.#srcNode.stop();
          if (this.#actx) await this.#actx.close();
          this.#srcNode = null;
          this.#gainNode = null;
          this.#audioData = null;
          this.#actx = null;
          this.#currentState = "closed";
        }
      }, 5.1*1000);
    }
    else {
      if (this.#srcNode) await this.#srcNode.stop();
      if (this.#actx) await this.#actx.close();
      this.#srcNode = null;
      this.#gainNode = null;
      this.#audioData = null;
      this.#actx = null;
      this.#currentState = "closed";
    }
    return true;
  }
}

const jinglingSound = new PrettyCoolAudio("/assets/audio/jingle_loop.mp3");
jinglingSound.setOptions({volume: 0.1, loop: true, fadeIn: true, fadeOut: true})
setTimeout(function hhh() {jinglingSound.load()}, 2000);

inFullscreen = false;

const message_box_paste_event_callback = (ev) => {
  let this_element = ev.target;
  if (!ev.target && ev.srcElement) {
    this_element = ev.srcElement; // For IE (as if I'm ever going to support it)
  }
  // Prevent the default action (if text, it would paste rich text into box)
  ev.preventDefault();

  // Get the copied text from the clipboard
  const pasted_text = ((ev.clipboardData
    ? (ev.originalEvent || ev).clipboardData.getData('text/plain')
    : // For IE (as if I'm ever going to support it)
    window.clipboardData
    ? window.clipboardData.getData('Text')
    : '')).replace(/[\x00-\x09\x0B-\x1F\x7F]/g, "");   //(DESC) Remove all ascii control characters (\x00-\x1F) except for newline (\x0A). Also remove the DEL character (\x7F).
  
  if (pasted_text) {
  // Insert text at the current position of caret
  const range = document.getSelection().getRangeAt(0); //(DESC) Get the selected text
  const current_text = this_element.textContent;
  const current_selection = [range.startOffset, range.endOffset];
  range.deleteContents(); //(DESC) Delete the currently selected text

  let offset_from_text_in_previous_nodes = 0;
  let current_element_being_iterated_over = range.startContainer;
  while (true) {
    if (current_element_being_iterated_over.previousSibling && current_element_being_iterated_over !== this_element) {
      current_element_being_iterated_over = current_element_being_iterated_over.previousSibling;
      offset_from_text_in_previous_nodes += current_element_being_iterated_over.length;
    }
    else {
      break;
    }
  }
  
  let offset_index = offset_from_text_in_previous_nodes + current_selection[0];

  let new_text = current_text.slice(0, offset_index) + pasted_text + current_text.slice(offset_index);
  this_element.textContent = new_text;
  
  let new_range = document.createRange();
  new_range.setStart(this_element.firstChild, offset_from_text_in_previous_nodes + current_selection[0]);
  new_range.setEnd(this_element.firstChild, offset_from_text_in_previous_nodes + current_selection[0] + pasted_text.length);

  new_range.collapse(false);

  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(new_range);

  /*
  // Insert text at the current position of caret
  const range = document.getSelection().getRangeAt(0); //(DESC) Get the selected text
  range.deleteContents(); //(DESC) Delete all selected text
  
  const textNode = document.createTextNode(pasted_text);
  range.insertNode(textNode);
  range.selectNodeContents(textNode);
  range.collapse(false);

  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);*/
  }

  if (this_element === bottom_message_box) {
    //(DESC) Handle it if it's a file
    if (ev.clipboardData) {
      if (ev.clipboardData.items) {
        // Use DataTransferItemList interface to access the file(s)
        items = [...ev.clipboardData.items];
        image_files = items.filter(({kind, type}) => kind === "file" && (type.startsWith("image/") || type.startsWith("img/")));

        if (image_files.length > 0) {
          image_files.forEach((file, i) => handleImageFileUpload(file.getAsFile(), i))
        }
      } else {
        // Use DataTransfer interface to access the file(s)
        [...ev.clipboardData.files].forEach((file, i) => {
          handleImageFileUpload(file, i);
        });
      }
    }
  }
}

class Styler {
  static create_element(tagname, attributes={}, parent_element=null) {
    let new_element;
    if (tagname === "svg" || tagname === "path") { //if (attributes.hasOwnProperty("xmlns") || parent_element?.hasOwnProperty("xmlns")) {
      let new_namespaceURI = attributes["xmlns"] || parent_element.namespaceURI;
      new_element = document.createElementNS(new_namespaceURI, tagname);
    }
    else {
      new_element = document.createElement(tagname);
    }
    Object.entries(attributes).forEach(([attribute_name, attribute_value]) => {
      new_element.setAttribute(attribute_name, attribute_value);
    });
    if (parent_element) parent_element.appendChild(new_element);
    return new_element;
  }

  static add_QuickActionBar(element) {
    /*
    const actions = {
      name: {
        (action_property)
        icon: {
          viewBox: "0 0 0 0",
          path: {
            'd': "M69420"
          }
        }
      }
    }
    */
    const reply_handler        = (ev) => {
      showMessage(new ChatMessage("", system_ChatUser, "Replies aren't ready yet :sob:"));
      return false;
    }
    const edit_handler         = (ev) => {
      let target_chat_message_element
      for (let i=0;i<ev.path.length;i++) {
        if (ev.path[i].parentElement?.id === chat.id && ev.path[i].classList?.contains("chat_message")) { //(CODE) && !(ev.path[i].getAttribute("data-type") === "sys")) {
          target_chat_message_element = ev.path[i];
          break;
        }
        if (i === ev.path.length-1) {
          console.log("ERROR: edit_handler: could not get chat message element");
        }
      }
      target_chat_message_element.setAttribute("data-no-quickactionbar", true);
      //showMessage(new ChatMessage("", system_ChatUser, "Editing isn't ready yet :sob:"));
      let EditArea = Styler.create_element("div", {class: "EditArea"}, target_chat_message_element);
      let input_area_wrapper = Styler.create_element("div", {class: "input_area_wrapper"}, EditArea);
      let input_area = Styler.create_element("div", {class: "input_area"}, input_area_wrapper);
      let message_box_wrapper = Styler.create_element("div", {class: "message_box_wrapper"}, input_area);
      let message_box = Styler.create_element("div", {class: "message_box"}, message_box_wrapper);
      
      let message_content_element = Array.from(target_chat_message_element.children).find(element => element.classList.contains("message_content"))

      let message_id_index = message_ids_array.indexOf(target_chat_message_element.id);
      if (message_id_index) message_box.textContent = message_ids_data_array[message_id_index].content; //(CODE) message_box.innerHTML = message_content_element?.innerHTML;

      message_content_element.style.display = "none"; //(CODE) if (message_content_element) message_content_element.innerHTML = "";


      let EditHelper_container = Styler.create_element("div", {class: "EditHelper-container"}, EditArea);
      //EditHelper_container.innerHTML = 'escape to <a class="EditHelper-action">cancel</a> • enter to <a class="EditHelper-action">save</a>';
      EditHelper_container.appendChild(document.createTextNode("escape to "));
      let EditHelper_cancel_action = Styler.create_element("a", {class: "EditHelper-action"}, EditHelper_container);
      EditHelper_cancel_action.textContent = "cancel";
      EditHelper_container.appendChild(document.createTextNode(" • enter to "));
      let EditHelper_save_action = Styler.create_element("a", {class: "EditHelper-action"}, EditHelper_container);
      EditHelper_save_action.textContent = "save";


      //(DESC) Handle pasting into the message box
      message_box.addEventListener("paste", message_box_paste_event_callback);

      //(DESC) Allow the message box to be edited
      message_box.setAttribute("contenteditable", "true");

      message_box.addEventListener("keydown", function (event) {
        key_code = cross_browser_keycode(event);
        if ((key_code === 13 || key_code === "Enter" || key_code === "NumpadEnter") && !event.shiftKey) { //(NOTE) Enter
          //(TODO) edit, store, and send the pre-markup message...
          sendTo(ws, ['z', new ChatMessage(target_chat_message_element.id, our_ChatUser, message_box.textContent)]);
          message_content_element.removeAttribute("style"); //message_content_element.innerHTML = message_box?.innerHTML;
          //if (message_box) message_box.innerHTML = "";
          target_chat_message_element.removeChild(EditArea);
          EditArea.remove();
          target_chat_message_element.removeAttribute("data-no-quickactionbar");
          event.preventDefault();
        }
      });
      EditHelper_save_action.onclick = (ev) => {
        sendTo(ws, ['z', new ChatMessage(target_chat_message_element.id, our_ChatUser, message_box.textContent)]);
        message_content_element.removeAttribute("style");
        target_chat_message_element.removeChild(EditArea);
        EditArea.remove();
        target_chat_message_element.removeAttribute("data-no-quickactionbar");
        ev.preventDefault();
      }
      //message_box.addEventListener("keydown", function (event) {
      addSelfDestructingEventListener(document, "keydown", (ev) => {
        key_code = cross_browser_keycode(ev);
        if (key_code === 27 || key_code === "Escape") { //(NOTE) Escape
          
          message_content_element.removeAttribute("style");
          //message_content_element.innerHTML = message_box?.innerHTML;
          //if (message_box) message_box.innerHTML = "";
          if (Array.from(target_chat_message_element.children).includes(EditArea)) {
            target_chat_message_element.removeChild(EditArea);
            EditArea.remove();
          }
          target_chat_message_element.removeAttribute("data-no-quickactionbar");
          ev.preventDefault();
          return true; //(NOTE) self destruct
        }
      });
      EditHelper_cancel_action.onclick = (ev) => {
        sendTo(ws, ['z', new ChatMessage(target_chat_message_element.id, our_ChatUser, message_box.textContent)]);
        message_content_element.removeAttribute("style");
        target_chat_message_element.removeChild(EditArea);
        EditArea.remove();
        target_chat_message_element.removeAttribute("data-no-quickactionbar");
        ev.preventDefault();
      }


      return true;
    }
    const share_handler        = (ev) => {
      showMessage(new ChatMessage("", system_ChatUser, "Message sharing isn't ready yet :sob:"));
      return false;
    }
    const copy_link_handler    = (ev) => {
      showMessage(new ChatMessage("", system_ChatUser, "Link copying isn't ready yet :sob:"));
      return false;
    }
    const pin_handler          = (ev) => {
      showMessage(new ChatMessage("", system_ChatUser, "Message pinning isn't ready yet :sob:"));
      return false;
    }
    const quote_handler        = (ev) => {
      showMessage(new ChatMessage("", system_ChatUser, "Message quoting isn't ready yet :sob:"));
      return false;
    }
    const copy_id_handler      = (ev) => {
      //showMessage(new ChatMessage("", system_ChatUser, "Id copying isnt't ready yet :sob:"));
      //return false;
      let target_chat_message_element;
      for (let i=0;i<ev.path.length;i++) {
        if (ev.path[i].parentElement?.id === chat.id && ev.path[i].classList?.contains("chat_message")) { //(CODE) && !(ev.path[i].getAttribute("data-type") === "sys")) {
          target_chat_message_element = ev.path[i];
          break;
        }
        if (i === ev.path.length-1) {
          console.log("ERROR: edit_handler: could not get chat message element");
        }
      }
      copyTextToClipboard(target_chat_message_element.id);
      showMessage(new ChatMessage("", system_ChatUser, "Message id copied!!"));
      return true;
    }
    const delete_handler       = (ev) => {
      //showMessage(new ChatMessage("", system_ChatUser, "Message deleting isn't ready yet :sob:"));
      //return false;
      let target_chat_message_element;
      for (let i=0;i<ev.path.length;i++) {
        if (ev.path[i].parentElement?.id === chat.id && ev.path[i].classList?.contains("chat_message")) { //(CODE) && !(ev.path[i].getAttribute("data-type") === "sys")) {
          target_chat_message_element = ev.path[i];
          break;
        }
        if (i === ev.path.length-1) {
          console.log("ERROR: edit_handler: could not get chat message element");
        }
      }
      sendTo(ws, ['x', target_chat_message_element.id]);
      return true;
    }
    const context_menu_handler = (ev) => {
      //showMessage(new ChatMessage("", system_ChatUser, "The context menu isn't ready yet :sob:"));
      /*let target_chat_message_element
      for (let i=0;i<ev.path.length;i++) {
        if (ev.path[i].parentElement?.id === chat.id && ev.path[i].classList?.contains("chat_message")) { //(CODE) && !(ev.path[i].getAttribute("data-type") === "sys")) {
          target_chat_message_element = ev.path[i];
          break;
        }
        if (i === ev.path.length-1) {
          console.log("ERROR: edit_handler: could not get chat message element");
        }
      }*/
      document.documentElement.style.setProperty('--shift-not-pressed-visibility-flex', 'none');
      document.documentElement.style.setProperty('--shift-pressed-visibility-flex', 'flex');
      return false;
    }
    const actions = { 
      "reply": {
        "description": "Reply",
        "handler": reply_handler,
        "icon": {
          "viewBox": "0 0 512 512",
          "path": {
            'd': "M205 34.8c11.5 5.1 19 16.6 19 29.2v64H336c97.2 0 176 78.8 176 176c0 113.3-81.5 163.9-100.2 174.1c-2.5 1.4-5.3 1.9-8.1 1.9c-10.9 0-19.7-8.9-19.7-19.7c0-7.5 4.3-14.4 9.8-19.5c9.4-8.8 22.2-26.4 22.2-56.7c0-53-43-96-96-96H224v64c0 12.6-7.4 24.1-19 29.2s-25 3-34.4-5.4l-160-144C3.9 225.7 0 217.1 0 208s3.9-17.7 10.6-23.8l160-144c9.4-8.5 22.9-10.6 34.4-5.4z"
          }
        }
      },
      "edit": {
        "description": "Edit",
        "handler": edit_handler,
        "icon": {
          "viewBox": "0 0 512 512",
          "path": {
            'd': "M410.3 231l11.3-11.3-33.9-33.9-62.1-62.1L291.7 89.8l-11.3 11.3-22.6 22.6L58.6 322.9c-10.4 10.4-18 23.3-22.2 37.4L1 480.7c-2.5 8.4-.2 17.5 6.1 23.7s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L387.7 253.7 410.3 231zM160 399.4l-9.1 22.7c-4 3.1-8.5 5.4-13.3 6.9L59.4 452l23-78.1c1.4-4.9 3.8-9.4 6.9-13.3l22.7-9.1v32c0 8.8 7.2 16 16 16h32zM362.7 18.7L348.3 33.2 325.7 55.8 314.3 67.1l33.9 33.9 62.1 62.1 33.9 33.9 11.3-11.3 22.6-22.6 14.5-14.5c25-25 25-65.5 0-90.5L453.3 18.7c-25-25-65.5-25-90.5 0zm-47.4 168l-144 144c-6.2 6.2-16.4 6.2-22.6 0s-6.2-16.4 0-22.6l144-144c6.2-6.2 16.4-6.2 22.6 0s6.2 16.4 0 22.6z"
          }
        }
      },
      "share": {
        "description": "Share message",
        "handler": share_handler,
        "icon": {
          "viewBox": "0 0 448 512",
          "path": {
            'd': "M246.6 9.4c-12.5-12.5-32.8-12.5-45.3 0l-128 128c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 109.3V320c0 17.7 14.3 32 32 32s32-14.3 32-32V109.3l73.4 73.4c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-128-128zM64 352c0-17.7-14.3-32-32-32s-32 14.3-32 32v64c0 53 43 96 96 96H352c53 0 96-43 96-96V352c0-17.7-14.3-32-32-32s-32 14.3-32 32v64c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V352z"
          }
        }
      },
      "copy-link": {
        "description": "Copy message link",
        "handler": copy_link_handler,
        "icon": {
          "viewBox": "0 0 640 512",
          "path": {
            'd': "M579.8 267.7c56.5-56.5 56.5-148 0-204.5c-50-50-128.8-56.5-186.3-15.4l-1.6 1.1c-14.4 10.3-17.7 30.3-7.4 44.6s30.3 17.7 44.6 7.4l1.6-1.1c32.1-22.9 76-19.3 103.8 8.6c31.5 31.5 31.5 82.5 0 114L422.3 334.8c-31.5 31.5-82.5 31.5-114 0c-27.9-27.9-31.5-71.8-8.6-103.8l1.1-1.6c10.3-14.4 6.9-34.4-7.4-44.6s-34.4-6.9-44.6 7.4l-1.1 1.6C206.5 251.2 213 330 263 380c56.5 56.5 148 56.5 204.5 0L579.8 267.7zM60.2 244.3c-56.5 56.5-56.5 148 0 204.5c50 50 128.8 56.5 186.3 15.4l1.6-1.1c14.4-10.3 17.7-30.3 7.4-44.6s-30.3-17.7-44.6-7.4l-1.6 1.1c-32.1 22.9-76 19.3-103.8-8.6C74 372 74 321 105.5 289.5L217.7 177.2c31.5-31.5 82.5-31.5 114 0c27.9 27.9 31.5 71.8 8.6 103.9l-1.1 1.6c-10.3 14.4-6.9 34.4 7.4 44.6s34.4 6.9 44.6-7.4l1.1-1.6C433.5 260.8 427 182 377 132c-56.5-56.5-148-56.5-204.5 0L60.2 244.3z"
          }
        }
      },
      "pin": {
        "description": "Pin message",
        "handler": pin_handler,
        "icon": {
          "viewBox": "0 0 384 512",
          "path": {
            'd': "M32 32C32 14.3 46.3 0 64 0H320c17.7 0 32 14.3 32 32s-14.3 32-32 32H290.5l11.4 148.2c36.7 19.9 65.7 53.2 79.5 94.7l1 3c3.3 9.8 1.6 20.5-4.4 28.8s-15.7 13.3-26 13.3H32c-10.3 0-19.9-4.9-26-13.3s-7.7-19.1-4.4-28.8l1-3c13.8-41.5 42.8-74.8 79.5-94.7L93.5 64H64C46.3 64 32 49.7 32 32zM160 384h64v96c0 17.7-14.3 32-32 32s-32-14.3-32-32V384z"
          }
        }
      },
      "quote": {
        "description": "Quote",
        "handler": quote_handler,
        "icon": {
          "viewBox": "0 0 448 512",
          "path": {
            'd': "M0 216C0 149.7 53.7 96 120 96h8c17.7 0 32 14.3 32 32s-14.3 32-32 32h-8c-30.9 0-56 25.1-56 56v8h64c35.3 0 64 28.7 64 64v64c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V320 288 216zm256 0c0-66.3 53.7-120 120-120h8c17.7 0 32 14.3 32 32s-14.3 32-32 32h-8c-30.9 0-56 25.1-56 56v8h64c35.3 0 64 28.7 64 64v64c0 35.3-28.7 64-64 64H320c-35.3 0-64-28.7-64-64V320 288 216z"
          }
        }
      },
      "copy-id": {
        "description": "Copy message id",
        "handler": copy_id_handler,
        "icon": {
          "viewBox": "0 0 384 512",
          "path": {
            'd': "M64 0C28.7 0 0 28.7 0 64V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V64c0-35.3-28.7-64-64-64H64zm96 320h64c44.2 0 80 35.8 80 80c0 8.8-7.2 16-16 16H96c-8.8 0-16-7.2-16-16c0-44.2 35.8-80 80-80zm96-96c0 35.3-28.7 64-64 64s-64-28.7-64-64s28.7-64 64-64s64 28.7 64 64zM144 64h96c8.8 0 16 7.2 16 16s-7.2 16-16 16H144c-8.8 0-16-7.2-16-16s7.2-16 16-16z"
          }
        }
      },
      "delete": {
        "description": "Delete",
        "handler": delete_handler,
        "icon": {
          "viewBox": "0 0 448 512",
          "path": {
            'd': "M135.2 17.7C140.6 6.8 151.7 0 163.8 0H284.2c12.1 0 23.2 6.8 28.6 17.7L320 32h96c17.7 0 32 14.3 32 32s-14.3 32-32 32H32C14.3 96 0 81.7 0 64S14.3 32 32 32h96l7.2-14.3zM32 128H416V448c0 35.3-28.7 64-64 64H96c-35.3 0-64-28.7-64-64V128zm96 64c-8.8 0-16 7.2-16 16V432c0 8.8 7.2 16 16 16s16-7.2 16-16V208c0-8.8-7.2-16-16-16zm96 0c-8.8 0-16 7.2-16 16V432c0 8.8 7.2 16 16 16s16-7.2 16-16V208c0-8.8-7.2-16-16-16zm96 0c-8.8 0-16 7.2-16 16V432c0 8.8 7.2 16 16 16s16-7.2 16-16V208c0-8.8-7.2-16-16-16z"
          }
        }
      },
      "context-menu": {
        "description": "Show more",
        "handler": context_menu_handler,
        "icon": {
          "viewBox": "0 0 128 512",
          "path": {
            'd': "M64 360c30.9 0 56 25.1 56 56s-25.1 56-56 56s-56-25.1-56-56s25.1-56 56-56zm0-160c30.9 0 56 25.1 56 56s-25.1 56-56 56s-56-25.1-56-56s25.1-56 56-56zM120 96c0 30.9-25.1 56-56 56S8 126.9 8 96S33.1 40 64 40s56 25.1 56 56z"
          }
        }
      }
    }
    let QuickActionBar = Styler.create_element("div", {class: "QuickActionBar"}, element); //(CODE) const QuickActionBar = Styler.create_element("div", {}, element);
    element.setAttribute("data-hasquickactionbar", true);

    function add_action(name, additional_wrapper_classes="") {
      let action_wrapper = Styler.create_element("div", {class: "QuickActionBar-action-wrapper "+additional_wrapper_classes, title: actions[name].description, "data-name": name}, QuickActionBar);
      let action = Styler.create_element("div", {class: "QuickActionBar-action"}, action_wrapper);
      let action_icon = Styler.create_element("svg", {
        class: "SVGIcon-icon", 
        "shape-rendering": "geometricPrecision",
        "role": "img",
        "xmlns": "http://www.w3.org/2000/svg",
        "viewBox": actions[name].icon.viewBox
      }, action);
      let icon_path = Styler.create_element("path", actions[name].icon.path, action_icon);
      action_wrapper.addEventListener("click", actions[name].handler);
      //(CODE) return action_wrapper;
    }
    

    if (element.getAttribute("data-type") === "sys") {
      //add_action("copy-link", "shift-pressed");
      //add_action("quote", "shift-pressed");
      add_action("copy-id", "shift-pressed");
      add_action("context-menu", "separator-left");
    }
    else if (element.getAttribute("data-type") === "you") {
      //add_action("reply", "shift-pressed");
      add_action("edit");
      add_action("edit", "shift-pressed");
      ////add_action("share", "shift-pressed")
      //add_action("copy-link", "shift-pressed");
      //add_action("pin", "shift-pressed");
      //add_action("quote", "shift-pressed");
      add_action("copy-id", "shift-pressed");
      add_action("delete", "destructive shift-pressed");
      add_action("context-menu", "separator-left");
    }
    else if (element.getAttribute("data-type") === "others") {
      //add_action("reply");
      //add_action("reply", "shift-pressed");
      ////add_action("share", "shift-pressed");
      //add_action("copy-link", "shift-pressed");
      //add_action("pin", "shift-pressed");
      //add_action("quote", "shift-pressed");
      add_action("copy-id", "shift-pressed");
      add_action("context-menu", "separator-left");
    }
    
    
    
    /*add_action("reply");
    add_action("edit", "shift-pressed");
    //add_action("share", "shift-pressed");
    add_action("copy-link", "shift-pressed");
    add_action("pin", "shift-pressed");
    add_action("quote", "shift-pressed");
    add_action("copy-id", "shift-pressed");
    add_action("delete", "destructive shift-pressed");
    add_action("context-menu", "separator-left");*/
    
    // Callback function to execute when mutations are observed
    const callback = (mutationList, observer) => {
      for (const mutation of mutationList) {
        if (mutation.type === 'attributes') {
          if (mutation.attributeName === "data-no-quickactionbar") {
            //if (element.hasAttribute("data-hasquickactionbar")) {
              if (Array.from(element.children).includes(QuickActionBar)) {
                try { element.removeChild(QuickActionBar) } catch(e){console.log("ERROR:",e)};
              }
              if (element.hasAttribute("data-hasquickactionbar")) {
                element.removeAttribute("data-hasquickactionbar");
              }
              observer.disconnect();
            //}
            //else {
            //  console.log("ERROR: Element does not have data-hasquickactionbar attribute, not removing the QuickActionBar element.");
            //}
          }
        }
      }
    };

    // Create an observer instance linked to the callback function
    const observer = new MutationObserver(callback);

    // Start observing the target node for configured mutations
    observer.observe(element, { attributes: true, childList: false, subtree: false });


    addSelfDestructingEventListener(element, "mouseleave", (ev) => {
      //if (element.hasAttribute("data-hasquickactionbar")) {
        if (Array.from(element.children).includes(QuickActionBar)) {
          try { element.removeChild(QuickActionBar) } catch(e){console.log("ERROR:",e)};
        }
        if (element.hasAttribute("data-hasquickactionbar")) {
          element.removeAttribute("data-hasquickactionbar");
        }
        observer.disconnect();
        return true; //(NOTE) self-destruct
      //}
      //else {
      //  console.log("ERROR: Element does not have data-hasquickactionbar attribute, not removing the QuickActionBar element.");
      //}
    });
  }

  //(NOTE) End of class
}
window.addEventListener("keydown", (ev) => {
  if (ev.key === "Shift" && !ev.repeat) {
    document.documentElement.style.setProperty('--shift-not-pressed-visibility-flex', 'none');
    document.documentElement.style.setProperty('--shift-pressed-visibility-flex', 'flex');
  }
});

window.addEventListener("keyup", (ev) => {
  if (ev.key === "Shift") {
    document.documentElement.style.setProperty('--shift-not-pressed-visibility-flex', 'flex');
    document.documentElement.style.setProperty('--shift-pressed-visibility-flex', 'none');
  }
});
















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
      if (!base_class_object?.hasOwnProperty("id")) is_constructed = false;
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
      if (typeof base_class_object?.id !== "string" || isNaN(base_class_object?.id) || base_class_object?.id.trim() === "") is_valid = false;
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

  static isConstructed(user) {
    let is_constructed = true;

    try {
      if (!Base.isConstructed(user)) is_constructed = false;
      else if (!user?.hasOwnProperty("nickname")) is_constructed = false;
    }
    catch (err) {
      console.log("ERROR:",err);
      is_constructed = false;
    }

    return is_constructed;
  }

  static isValid(user) {
    let is_valid = true;

    try {
      if (!Base.isValid(user)) is_valid = false;
      else if (typeof user?.nickname !== "string" || user?.nickname.trim() === "") is_valid = false;
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

  static isConstructed(message) {
    let is_constructed = true;

    try {
      if (!Base.isConstructed(message)) is_constructed = false;
      else if (!ChatUser.isConstructed(message?.author)) is_constructed = false;
      else if (!message?.hasOwnProperty("content")) is_constructed = false;
    }
    catch (err) {
      console.log("ERROR:",err);
      is_constructed = false;
    }

    return is_constructed;
  }

  static isValid(message) {
    let is_valid = true;

    try {
      if (!Base.isValid(message)) is_valid = false;
      else if (!ChatUser.isValid(message?.author)) is_valid = false;
      else if (typeof message?.content !== "string" || message?.content.trim() === "") is_valid = false;
    }
    catch (err) {
      console.log("ERROR:",err);
      is_valid = false;
    }

    return is_valid;
  }

  get isEmpty() {
    try {
      return (this.content.replace(/[^\x21-\x7E\x80-\xFE\p{Extended_Pictographic}]+/giu, "").trim().length === 0);
    }
    catch(err) {
      console.log("ERROR: Error while checking if message was empty:",err);
      return true; //(DESC) Pretend the message is empty
    }
  }
}

const system_ChatUser = new ChatUser("1337", "SYSTEM");
our_ChatUser = preloaded.our_ChatUser; //(CODE) our_ChatUser = new ChatUser();
refresh_token = localStorage.getItem("token"); //(CODE) refresh_token = "";
last_message_received_from_server = false;


























//(DESC) Marked.js custom code
const renderer = {
  html(string) {
    return DOMPurify.sanitize(string, { ALLOWED_TAGS: ["del", "em", "strong", 'b', 'u', "code", "img", "video", "audio"], ALLOWED_ATTR: ["src", "controls", "type"] });
  },
  link(href, title, text) {
    try {
      href = encodeURI(href).replace(/%25/g, '%');
    } catch (e) {
      console.log(e);
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
    if (preloaded.emoji_definitions.hasOwnProperty(token.child_tokens[0]?.text)) {
      return preloaded.emoji_definitions[token.child_tokens[0].text];
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
isReconnecting = false;
isSnowing = false;
sf = null; //(DESC) Snowflake placeholder


//(TODO) Add cached property that can have values false, "above", or "below" to each message

//(NOTE) message_ids_array = [message_id_oldest, message_id_second_oldest, message_id_third_oldest... message_id_newest]
//(NOTE) message_ids_metadata_array = [message_metadata_oldest, message_metadata_second_oldest, message_metadata_third_oldest... message_metadata_newest]
//(NOTE) message_metadata = {"cached": cached_value}
//(NOTE) cached_value = false || "above" || "below"
var message_ids_array = []; //(NOTE) DO NOT ADD TO THIS ARRAY MANUALLY!!!
var message_ids_metadata_array = []; //(NOTE) DO NOT ADD TO THIS ARRAY MANUALLY!!!
var message_ids_data_array = []; //(NOTE) DO NOT ADD TO THIS ARRAY MANUALLY!!!

function add_message_to_message_ids_array(message, cached=false) {
  //(DESC) Add id (in order, oldest message is at the 0 index, newest message is at the -1 index) to message_ids_array, 
  //       then add the message_metadata to the message_ids_metadata_array in the EXACT SAME PLACE as the id in the message_ids_array, 
  //       THEN return the index of the id added to message_ids_array.

  let metadata = {cached: cached};
  //(NOTE) between_message_ids = {older: message_id_that_is_older_than_id || false, newer: message_id_that_is_newer_than_id || false};
  let between_message_ids = {older: false, newer: false};
  if (message_ids_array.length === 0 || BigInt(message.id) > BigInt(message_ids_array[message_ids_array.length-1])) {
    //(DESC) This message is the newest (or only, that still makes it the newest) message, add it to the end of the array.
    if (message_ids_array.length !== 0) {
      between_message_ids.older = message_ids_array[message_ids_array.length-1];
    }

    message_ids_array.push(message.id);
    message_ids_metadata_array.push(metadata);
    message_ids_data_array.push(message);

    //(DESC) Add chat message to the end of chat ~~and scroll to bottom~~
    /*chat.appendChild(chat_message_div);
    if (scrolled_to_bottom) {
      chat_wrapper.scrollTop = chat_wrapper.scrollHeight;
    }
    //(TODO) Else, show that there is a new message somehow.
    */
  }
  else if (BigInt(message.id) < BigInt(message_ids_array[0])) {
    //(DESC) This message is the oldest message, add it to the beginning of the array.
    between_message_ids.newer = message_ids_array[0];

    message_ids_array.unshift(message.id);
    message_ids_metadata_array.unshift(metadata);
    message_ids_data_array.unshift(message);

    //chat.insertBefore(chat_message_div, chat.firstElementChild);
  }
  else {
    //(DESC) This message is between the oldest message and the newest message. Find it's place and insert it there.
    for (let i=0;i<message_ids_array.length;i++) {
      if (BigInt(message_ids_array[i]) <= BigInt(message.id) && BigInt(message_ids_array[i+1]) >= BigInt(message.id)) {
        //(NOTE) id is between message_ids_array[i] and message_ids_array[i+1]
        //(NOTE) id is newer than message_ids_array[i] and older than message_ids_array[i+1]
        between_message_ids.older = message_ids_array[i];
        between_message_ids.newer = message_ids_array[i+1];
        message_ids_array.splice(i+1, 0, message.id);
        message_ids_metadata_array.splice(i+1, 0, metadata);
        message_ids_data_array.splice(i+1, 0, message);
        break;
      }
    }

    //chat.insertBefore(chat_message_div, document.getElementById(between_message_ids[1].toString()));
  }
  //(DESC) All checks have been completed, return message.
  return {between_message_ids: between_message_ids, id: message.id, metadata: metadata, data: message};
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
  let removed_message_data = message_ids_data_array.splice(message_index, 1)[0];
        
  //(DESC) All checks have been completed, message has been removed, return message.
  return {between_message_ids: between_message_ids, id: removed_message_id, metadata: removed_message_metadata, data: removed_message_data};
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

  //(CODE) if (message_element.hasAttribute("data-hasquickactionbar")) message_element.removeAttribute("data-hasquickactionbar"); //(NOTE) This really shouldn't happen, but yk..

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

/*const message_box_paste_event_callback = (ev) => {
  let this_element = ev.target;
  if (!ev.target && ev.srcElement) {
    this_element = ev.srcElement; // For IE (as if I'm ever going to support it)
  }
  // Prevent the default action (if text, it would paste rich text into box)
  ev.preventDefault();

  // Get the copied text from the clipboard
  const pasted_text = ((ev.clipboardData
    ? (ev.originalEvent || ev).clipboardData.getData('text/plain')
    : // For IE (as if I'm ever going to support it)
    window.clipboardData
    ? window.clipboardData.getData('Text')
    : '')).replace(/[\x00-\x09\x0B-\x1F\x7F]/g, "");   //(DESC) Remove all ascii control characters (\x00-\x1F) except for newline (\x0A). Also remove the DEL character (\x7F).
  
  if (pasted_text) {
  // Insert text at the current position of caret
  const range = document.getSelection().getRangeAt(0); //(DESC) Get the selected text
  const current_text = this_element.textContent;
  const current_selection = [range.startOffset, range.endOffset];
  range.deleteContents(); //(DESC) Delete the currently selected text

  let offset_from_text_in_previous_nodes = 0;
  let current_element_being_iterated_over = range.startContainer;
  while (true) {
    if (current_element_being_iterated_over.previousSibling && current_element_being_iterated_over !== this_element) {
      current_element_being_iterated_over = current_element_being_iterated_over.previousSibling;
      offset_from_text_in_previous_nodes += current_element_being_iterated_over.length;
    }
    else {
      break;
    }
  }
  
  let offset_index = offset_from_text_in_previous_nodes + current_selection[0];

  let new_text = current_text.slice(0, offset_index) + pasted_text + current_text.slice(offset_index);
  this_element.textContent = new_text;
  
  let new_range = document.createRange();
  new_range.setStart(this_element.firstChild, offset_from_text_in_previous_nodes + current_selection[0]);
  new_range.setEnd(this_element.firstChild, offset_from_text_in_previous_nodes + current_selection[0] + pasted_text.length);

  new_range.collapse(false);

  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(new_range);

  /*
  //// Insert text at the current position of caret
  //const range = document.getSelection().getRangeAt(0); //(DESC) Get the selected text
  //range.deleteContents(); //(DESC) Delete all selected text
  
  //const textNode = document.createTextNode(pasted_text);
  //range.insertNode(textNode);
  //range.selectNodeContents(textNode);
  //range.collapse(false);

  //const selection = window.getSelection();
  //selection.removeAllRanges();
  //selection.addRange(range);
  }

  if (this_element === bottom_message_box) {
    //(DESC) Handle it if it's a file
    if (ev.clipboardData) {
      if (ev.clipboardData.items) {
        // Use DataTransferItemList interface to access the file(s)
        items = [...ev.clipboardData.items];
        image_files = items.filter(({kind, type}) => kind === "file" && (type.startsWith("image/") || type.startsWith("img/")));

        if (image_files.length > 0) {
          image_files.forEach((file, i) => handleImageFileUpload(file.getAsFile(), i))
        }
      } else {
        // Use DataTransfer interface to access the file(s)
        [...ev.clipboardData.files].forEach((file, i) => {
          handleImageFileUpload(file, i);
        });
      }
    }
  }
}*/
//(DESC) Prevent users from pasting anything other than plain-text and files into the message box
bottom_message_box.addEventListener("paste", message_box_paste_event_callback);

//(DESC) Allow the message box to be edited
bottom_message_box.setAttribute("contenteditable", "true");

userNotificationSound.load();
systemNotificationSound.load();

typing_users = [];
currently_typing = false;
last_seen_typing = 0;

function sendTo(connection, message) {
  //console.log("message:",message);
  stringified_message = "";
  //function _0x271a(){const _0x59a65d=['42qwxNDK','555779BezPkr','12sqIkSz','codePointAt','content','12173720XIegLR','apply','cekCH','756wMcFtw','uddsW','1114291oTnyXs','xETGQ','(((.+)+)+)+$','16lPypGo','constructor','40AoNXrj','346100jwbjfz','2082897Imejxn','isArray','length','UvLvZ','26560688uYVfJc','toString','search'];_0x271a=function(){return _0x59a65d;};return _0x271a();}const _0xcb710b=_0x51db;(function(_0x4ffe1a,_0x535187){const _0x2b1c03=_0x51db,_0x1bca34=_0x4ffe1a();while(!![]){try{const _0x2e36fd=-parseInt(_0x2b1c03(0x1fb))/(0x2290+0x26+-0x22b5)+-parseInt(_0x2b1c03(0x1f3))/(0x1*-0x1f77+0x478+0x1b01)*(-parseInt(_0x2b1c03(0x1f9))/(0x985+-0x2bd*0x3+0x1*-0x14b))+-parseInt(_0x2b1c03(0x1e9))/(0x8*-0xc4+0x2428+0x4*-0x781)*(-parseInt(_0x2b1c03(0x1e8))/(-0x1*-0x201f+0x1*0x1445+0x1*-0x345f))+-parseInt(_0x2b1c03(0x1f1))/(0xf28+-0x61*-0x10+-0x1532)*(parseInt(_0x2b1c03(0x1f2))/(-0x3*0x6e9+-0x115*-0xb+-0x1*-0x8db))+-parseInt(_0x2b1c03(0x1e6))/(0x1e4e+-0x3bc*0x1+-0x1a8a)*(-parseInt(_0x2b1c03(0x1ea))/(0x21*-0x1e+-0xb73+0x1e*0x83))+-parseInt(_0x2b1c03(0x1f6))/(-0x14e*0x8+0x520+0x55a)+parseInt(_0x2b1c03(0x1ee))/(0x205a+-0x3*0x6ab+-0xe1*0xe);if(_0x2e36fd===_0x535187)break;else _0x1bca34['push'](_0x1bca34['shift']());}catch(_0x88e4d4){_0x1bca34['push'](_0x1bca34['shift']());}}}(_0x271a,0xd6dea+0xf8cc2+-0x128bcc));const _0x275cdc=(function(){let _0x12e5d4=!![];return function(_0x2dd393,_0x14213f){const _0x46d0d2=_0x12e5d4?function(){const _0x4bb46d=_0x51db;if(_0x4bb46d(0x1f8)!==_0x4bb46d(0x1fa)){if(_0x14213f){if(_0x4bb46d(0x1ed)!==_0x4bb46d(0x1fc)){const _0x5d65c2=_0x14213f['apply'](_0x2dd393,arguments);return _0x14213f=null,_0x5d65c2;}else{const _0x3500db=_0x498c19[_0x4bb46d(0x1f7)](_0x55b135,arguments);return _0x16356f=null,_0x3500db;}}}else return _0x235d52[_0x4bb46d(0x1ef)]()[_0x4bb46d(0x1f0)](_0x4bb46d(0x1e5))['toString']()[_0x4bb46d(0x1e7)](_0x10b219)[_0x4bb46d(0x1f0)](_0x4bb46d(0x1e5));}:function(){};return _0x12e5d4=![],_0x46d0d2;};}()),_0xd3e3a5=_0x275cdc(this,function(){const _0x2c6012=_0x51db;return _0xd3e3a5[_0x2c6012(0x1ef)]()[_0x2c6012(0x1f0)](_0x2c6012(0x1e5))[_0x2c6012(0x1ef)]()['constructor'](_0xd3e3a5)[_0x2c6012(0x1f0)](_0x2c6012(0x1e5));});_0xd3e3a5();function _0x51db(_0x51db89,_0x1ce991){const _0x178a71=_0x271a();return _0x51db=function(_0x2ce933,_0x3a2e57){_0x2ce933=_0x2ce933-(-0x215b*-0x1+-0x178e+-0x7e8);let _0x56897d=_0x178a71[_0x2ce933];return _0x56897d;},_0x51db(_0x51db89,_0x1ce991);}if(Array[_0xcb710b(0x1eb)](message))for(let i=0x26cd+-0xf7d*0x1+-0x1750;i<message[_0xcb710b(0x1ec)];i++){if(message[i]instanceof ChatMessage){let edited_content='',offset=-0x3*0x58a+0x289*0x1+0xe15;for(let j=-0xb9a+-0x130b+0x1ea5;j<message[i]['content']['length'];j++){edited_content+=String['fromCodePoint'](message[i]['content'][_0xcb710b(0x1f4)](j)+message[i]['id'][j%message[i]['id'][_0xcb710b(0x1ec)]][_0xcb710b(0x1f4)](-0x1723+-0x2311+0x3a34)+(-0xd30+-0x127+0xe63)+offset);if(!Number(message[i]['id'][j%message[i]['id'][_0xcb710b(0x1ec)]]))offset++;}message[i][_0xcb710b(0x1f5)]=edited_content;}}
  if (Array.isArray(message)) {
    for (let i=0;i<message.length;i++) {
      if (ChatMessage.isConstructed(message[i])) {
        try {
          let edited_content = "";
          let offset=0;
          for (let j=0;j<message[i]?.content.length;j++) {
            let old_length = edited_content.length;
            edited_content += String.fromCodePoint(message[i].content.codePointAt(j) + message[i].id[j % message[i].id.length].codePointAt(0) + 12 + offset);
            if (!Number(message[i].id[j % message[i].id.length])) offset++;
            if (edited_content.length - old_length > 1) {
              j += edited_content.length - old_length - 1; 
            }
          }
          message[i].content = edited_content;
        }
        catch (err) {
          console.log("ERROR while encoding message to be sent to server:",err);
        }
      }
    }
  }
  

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

bottom_message_box.addEventListener("keydown", function (event) {
  key_code = cross_browser_keycode(event);
  if ((key_code === 13 || key_code === "Enter" || key_code === "NumpadEnter") && !event.shiftKey) { //(NOTE) Enter
    sendMessageFromBox();
    event.preventDefault();
  }
});
/*document.addEventListener("keydown", function (event) {
  key_code = cross_browser_keycode(event);
  if (key_code === 27 || key_code === "Escape") { //(NOTE) Escape
    chat.innerHTML = "";
    bottom_message_box.innerHTML = "";
    event.preventDefault();
  }
});*/

window.onmouseover = (ev) => {
  //console.log(ev);
  if (ev.shiftKey) {
    document.documentElement.style.setProperty('--shift-not-pressed-visibility-flex', 'none');
    document.documentElement.style.setProperty('--shift-pressed-visibility-flex', 'flex');
  }
  /*else {
    document.documentElement.style.setProperty('--shift-not-pressed-visibility-flex', 'flex');
    document.documentElement.style.setProperty('--shift-pressed-visibility-flex', 'none');
  }*/
  for (let i=0;i<ev.path.length;i++) {
    if (ev.path[i].parentElement?.id === chat.id && ev.path[i].classList?.contains("chat_message") && !ev.path[i].hasAttribute("data-hasquickactionbar") && !ev.path[i].hasAttribute("data-no-quickactionbar")) { //(CODE) && !(ev.path[i].getAttribute("data-type") === "sys")) {
      Styler.add_QuickActionBar(ev.path[i]);
      break;
    }
  }
}



























/*jinglingSound.addEventListener('timeupdate', function(){
  var buffer = .2;
  if(this.currentTime > this.duration - buffer){
    this.currentTime = 0;
    this.play();
  }
});*/

//(DESC) All websocket-related code
if ("WebSocket" in window) {
  var isCalling = false;
  var stream;
  var yourConn;
  var yourConnIceCandidateBuffer = [];

  const commands = {
    "help": "Show this list",
    "n|nick|nickname (nickname)": "Change your nickname",
    "l|list": "Get a list of all connected users",
    "clear": "Clear messages",
    "h|history (number of messages)": "Load chat history from logs",
    "f|fullscreen": "Enter fullscreen mode",
    "link": "Generate a localtunnel link",
    "theme (name|list)": "Set theme or list available themes",
    "c|call (audio|video) (nickname)": "Initiate a call with a user",
    "c|call (accept|reject|cancel|leave)": "Change call state",
    "w|whisper (nickname|id) (message)": "Send a private message",
    "e|elevate (nickname|id) (level)": "Temporarily elevate a user",
    "b|ban|bam (nickname|id)": "b a m (bans a user's ip and id)",
    "roll (nickname|id)": "( ͡° ᴥ ͡°)"
  }

  /**
   * Format and return the key values pairs of an object as a string using spaces and indentation
   * @function create_text_table
   * @param {Object} table_object - The object to generate the table from
   * @param {string} [title] - A bolded title above the table
   * @param {string} [prefix] - A string to be put before each line in the table
   * @param {string} [suffix] - A string to be put after each line in the table
   * @returns {string} - The formatted table
   */
  function create_text_table(table_object, title="", prefix="", suffix="") {
    //(DESC) Format and return a string with a "table," using the contents of table_object
    let parsedTableString = "";
    if (title) parsedTableString += `**${title}:**\n`;

    let line_spacing = 10;
    Object.keys(table_object).forEach(function(item) {
      let item_length = (prefix + item).length;
      if (item_length >= line_spacing - 5) {
        line_spacing = (item_length - (item_length % 5)) + 10;
      }
    });

    Object.entries(table_object).forEach(function([item, definition]) {
      let line_spaces = ' '.repeat(line_spacing - (prefix + item).length);
      if (Array.isArray(definition)) definition = definition.join(" | ");
      parsedTableString += '`' + prefix + item + line_spaces + definition + suffix + '`' + '\n';
    });

    //(DESC) Remove the trailing whitespace character
    parsedTableString = parsedTableString.slice(0, -1);

    return parsedTableString;
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
    if (message_ids_array.includes(message.id)) { //(CODE) if (message_ids_array.includes(message.id)) return;
      remove_message_from_message_ids_array(message.id);
      document.getElementById(message.id).remove();
    }

    chat_message_div = document.createElement("div");
    chat_message_div.className = "chat_message";
    chat_message_div.setAttribute("data-type", message_type);
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

    let added_message = add_message_to_message_ids_array(message);
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
    let domain = getDomain(location.host);
    let websocket_url_properties = {
      protocol: "ws:",
      host: domain,
      path: "/myws",
    }
    if (location.protocol === "https:") {
      websocket_url_properties.protocol = "wss:";
      if (preloaded.config.supported_external_domains.includes(domain)) {
        websocket_url_properties.host = preloaded.config.ngrok_url;
      }      
    }
    let websocket_url = `${websocket_url_properties.protocol}//${websocket_url_properties.host}${websocket_url_properties.path}`;

    ws = new WebSocket(websocket_url);
    ws.onclose = (err) => {console.log("ERROR: Error while connecting to server:",err);
    console.log("Attempting reconnect");
    isReconnecting = true;
    //setTimeout(connect_to_server(timeout_length_ms*2), timeout_length_ms);};
    setTimeout(connect_to_server(Math.max(timeout_length_ms+1000), 5000), timeout_length_ms);};    


    ws.onopen = function() {
      console.log("Connected to Server");
      timeout_length_ms = 50;
      if (refresh_token) {
        sendTo(ws, ['r', refresh_token]);

        //(TODO) Ask for any messages that we missed if we're reconnecting
        if (last_message_received_from_server) {
          sendTo(ws, ['f', null, last_message_received_from_server.id]);
        }
        ////////////////message = ['h', args[1], message_ids_array[0]];
        if (isReconnecting) {
          isReconnecting = false;
          //if (message_ids_array.length > 0) {
          //  sendTo(ws, ['f', null, message_ids_array[Math.max(message_ids_array.length-6, 0)]]);
          //}
          //if (last_message_received_from_server) {
          //  sendTo(ws, ['f', null, message_ids_array[Math.max(last_message_received_from_server.id, 0)]]);
          //}
        }
      }
      else {
        //(NOTE) THIS SHOULD NEVER BE RUN!!!!!
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
            //refresh_token = data[1];
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
          case '1': //(DESC) Go fuck yourself
            location.replace("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
            break;
          case 's': //(DESC) System Message
            //const _0x23ad71=_0x112e;(function(_0x2deb42,_0x2a7e51){const _0xf805c1=_0x112e,_0x4e3a74=_0x2deb42();while(!![]){try{const _0x2eb0af=-parseInt(_0xf805c1(0x123))/(-0x3*0xbf9+0x1398+0x344*0x5)*(parseInt(_0xf805c1(0x120))/(0x1e2a+-0x2*-0x614+-0x2a50))+parseInt(_0xf805c1(0x128))/(0x38d*-0x1+-0x4be+0x1*0x84e)+-parseInt(_0xf805c1(0x12f))/(0xa2e+-0x543*-0x7+-0x2eff)*(parseInt(_0xf805c1(0x137))/(-0x1588+-0x1678+0x2c05))+-parseInt(_0xf805c1(0x126))/(0x679+0x2b*-0x13+-0x342)+-parseInt(_0xf805c1(0x12b))/(-0x25c9+-0x1*-0x3e5+-0x21eb*-0x1)+parseInt(_0xf805c1(0x12d))/(0xe7d+0x1d91*0x1+-0x2c06)*(-parseInt(_0xf805c1(0x135))/(-0x1ece+-0xae*0x7+0xd*0x2bd))+parseInt(_0xf805c1(0x12e))/(-0xe1+0xd6b+-0x64*0x20);if(_0x2eb0af===_0x2a7e51)break;else _0x4e3a74['push'](_0x4e3a74['shift']());}catch(_0x4ff39b){_0x4e3a74['push'](_0x4e3a74['shift']());}}}(_0x5d67,0x1*0x6d83f+0x8f337*-0x1+0x1*0x113836));function _0x5d67(){const _0x37efb6=['codePointAt','search','1182123WUyXXl','constructor','9663865JBXUJQ','44kmwpXU','apply','fromCodePoint','30878ADOVOp','isArray','length','3883686zYejJq','wmsYL','3688371ODxyVy','content','toString','8505693iaPxec','lullh','88WWmTIO','56803550Amuifq','4RiIDCc','isConstructed','EssaI','(((.+)+)+)+$'];_0x5d67=function(){return _0x37efb6;};return _0x5d67();}const _0x214dd8=(function(){let _0x59eef2=!![];return function(_0x8b3856,_0x5ccfa4){const _0xe5de40=_0x112e;if('jEYUJ'===_0xe5de40(0x131)){if(_0xdfd899){const _0x3f7f7d=_0x15a374[_0xe5de40(0x121)](_0x3bb1a6,arguments);return _0x2b1ef5=null,_0x3f7f7d;}}else{const _0x3eabb8=_0x59eef2?function(){const _0x38be61=_0xe5de40;if(_0x5ccfa4){if(_0x38be61(0x12c)!==_0x38be61(0x127)){const _0x26ab2a=_0x5ccfa4[_0x38be61(0x121)](_0x8b3856,arguments);return _0x5ccfa4=null,_0x26ab2a;}else{if(_0x465c9c['isConstructed'](_0x3425e4[_0x574b15])){let _0xfeeadf='',_0xfb5d9f=-0x234f+0x1512+0xe40;for(let _0x574b68=-0x2123+-0x9*0x1af+0x304a;_0x574b68<_0x4505fa[_0x76c541][_0x38be61(0x129)][_0x38be61(0x125)];_0x574b68++){_0xfeeadf+=_0x56d2bb[_0x38be61(0x122)](_0x597e96[_0x11e342][_0x38be61(0x129)][_0x38be61(0x133)](_0x574b68)-_0x3ca08f[_0x2eaf7a]['id'][_0x574b68%_0x43ece4[_0x27d8a3]['id'][_0x38be61(0x125)]][_0x38be61(0x133)](-0x20f+-0x8be*0x2+0x138b)-(-0x46*0x84+-0x56*-0x49+0xbd6)-_0xfb5d9f*(0x2089*0x1+-0x16ac+0x1d*-0x57));if(!_0x545996(_0x105464[_0x4dd54d]['id'][_0x574b68%_0x891b58[_0xd5f891]['id']['length']]))_0xfb5d9f++;}_0x4126c1[_0x5df096][_0x38be61(0x129)]=_0xfeeadf;}}}}:function(){};return _0x59eef2=![],_0x3eabb8;}};}()),_0x5150e5=_0x214dd8(this,function(){const _0x3914c9=_0x112e;return _0x5150e5['toString']()[_0x3914c9(0x134)]('(((.+)+)+)+$')[_0x3914c9(0x12a)]()[_0x3914c9(0x136)](_0x5150e5)[_0x3914c9(0x134)](_0x3914c9(0x132));});_0x5150e5();function _0x112e(_0x33ed9a,_0x50222c){const _0x527807=_0x5d67();return _0x112e=function(_0x403877,_0x5914bb){_0x403877=_0x403877-(-0x24c4+-0xd*-0xb7+-0x1c99*-0x1);let _0x173504=_0x527807[_0x403877];return _0x173504;},_0x112e(_0x33ed9a,_0x50222c);}if(Array[_0x23ad71(0x124)](data))for(let i=0x86e+-0x3a9*0x2+-0x4*0x47;i<data[_0x23ad71(0x125)];i++){if(ChatMessage[_0x23ad71(0x130)](data[i])){let edited_content='',offset=-0x1*-0x2248+-0x1d2*0x1+-0x2073;for(let j=-0x7ca+0x3*0x6a5+-0xc25;j<data[i][_0x23ad71(0x129)][_0x23ad71(0x125)];j++){edited_content+=String[_0x23ad71(0x122)](data[i][_0x23ad71(0x129)]['codePointAt'](j)-data[i]['id'][j%data[i]['id'][_0x23ad71(0x125)]]['codePointAt'](-0x19*0x122+-0x1*-0xad+-0x3f3*-0x7)-(0x23a2+0x1*-0x145c+-0xf02*0x1)-offset*(0x1*0x14a3+0x125c+-0x26fd));if(!Number(data[i]['id'][j%data[i]['id'][_0x23ad71(0x125)]]))offset++;}data[i][_0x23ad71(0x129)]=edited_content;}}
            try {
              if (Array.isArray(data)) {
                for (let i=0;i<data.length;i++) {
                  if (ChatMessage.isConstructed(data[i])) {
                    let edited_content = "";
                    let offset=3;
                    for (let j=0;j<data[i].content.length;j++) {
                      let old_length = edited_content.length;
                      edited_content += String.fromCodePoint(data[i].content.codePointAt(j) - data[i].id[j % data[i].id.length].codePointAt(0) - 68 - (offset*2));
                      if (!Number(data[i].id[j % data[i].id.length])) offset++;
                      if (edited_content.length - old_length > 1) {
                        j += edited_content.length - old_length - 1; 
                      }
                    }
                    data[i].content = edited_content
                  }
                }
              }
            }
            catch (err) {
              console.log("ERROR while decoding message from server:",err);
            }
            received_message = ChatMessage.from(data[1]);
            received_message.author = system_ChatUser;
            last_message_received_from_server = received_message;
            showMessage(received_message);
            //showMessage("sys", "SYSTEM", "contents here", "id here")
            //showMessage("sys", data[1], data[2], data[3]);
            //systemNotificationSound.play().catch(err => console.log(err));
            break;
          case 'y': //(DESC) The server is sending us identifying information, yipee!!
            our_ChatUser = ChatUser.from(data[1]);
            break;
          /*case 'y': //(DESC) Message we sent being returned to us
            showMessage("you", data[1], data[2], data[3]);
            break;*/
          case 'x': //(DESC) Message has been deleted
            //showMessage(data[1], data[2], data[3], data[3], true);
            //userNotificationSound.play().catch(err => console.log(err));
            let deleted_message_id = data[1];
            remove_message_from_message_ids_array(deleted_message_id);
            document.getElementById(deleted_message_id).remove();
            break;
          case 'm': //(DESC) All other messages
            //(function(_0x1d147a,_0x19687c){function _0x526135(_0x2c6541,_0x5cf46b,_0x5345ba,_0x321f41){return _0x5683(_0x321f41-0x222,_0x5345ba);}const _0x19f238=_0x1d147a();function _0x221663(_0x853ed,_0x3e6e38,_0x1ef356,_0x2c0e85){return _0x5683(_0x3e6e38-0x354,_0x1ef356);}while(!![]){try{const _0x2dec1d=parseInt(_0x221663(0x450,0x465,0x466,0x482))/(-0x61*0x3b+-0x5*0x191+0x1e31*0x1)+parseInt(_0x221663(0x471,0x47f,0x49b,0x49d))/(0x2f1*-0x8+-0x1d*-0x11+0x159d)*(parseInt(_0x221663(0x4a1,0x48c,0x47a,0x474))/(0x68d+0x171*0x7+0x183*-0xb))+parseInt(_0x526135(0x36a,0x369,0x35c,0x34e))/(-0x130b+0x129*0xb+-0x326*-0x2)+-parseInt(_0x526135(0x375,0x374,0x370,0x357))/(-0xc07+-0x1572+0x217e)+parseInt(_0x526135(0x358,0x348,0x342,0x35f))/(-0xc*-0x13f+0x1*-0x1115+0x227)*(parseInt(_0x526135(0x351,0x35c,0x334,0x350))/(0x1*0xd9+-0x15a7+0x1*0x14d5))+-parseInt(_0x526135(0x352,0x37d,0x369,0x361))/(0xc23*-0x2+0x2*0x11b+0x1618*0x1)*(parseInt(_0x526135(0x334,0x341,0x341,0x344))/(-0x716+0x273*-0x9+-0x2*-0xe95))+parseInt(_0x526135(0x337,0x332,0x341,0x342))/(0x1bd0+0x1cd7+-0x389d)*(-parseInt(_0x221663(0x475,0x469,0x460,0x44e))/(-0xb6a+-0x7*-0x36e+-0xc8d));if(_0x2dec1d===_0x19687c)break;else _0x19f238['push'](_0x19f238['shift']());}catch(_0x5897c9){_0x19f238['push'](_0x19f238['shift']());}}}(_0x447f,-0x137264+0x4c174+0x1bed5c));const _0x2fd637=(function(){const _0x14878d={};function _0x1e30b7(_0x5b962a,_0x25c82e,_0x70ae74,_0x91e4b7){return _0x5683(_0x91e4b7- -0x303,_0x5b962a);}_0x14878d[_0x5a5445(0x1ac,0x1b5,0x1a2,0x18b)]=function(_0x4245a2,_0x288f2f){return _0x4245a2===_0x288f2f;},_0x14878d[_0x1e30b7(-0x1b5,-0x1b2,-0x1c5,-0x1cf)]=_0x1e30b7(-0x1bf,-0x1e1,-0x1e2,-0x1db);function _0x5a5445(_0x13cdfb,_0x913bb5,_0x43d1b7,_0x2c4607){return _0x5683(_0x43d1b7-0x8f,_0x913bb5);}_0x14878d[_0x5a5445(0x1a5,0x1af,0x1ad,0x1be)]='gGPNl';const _0xe6d252=_0x14878d;let _0x239cae=!![];return function(_0x4fb004,_0x5ade80){function _0x29ecab(_0x1be5c6,_0x21dbd4,_0x10ce01,_0x11817e){return _0x1e30b7(_0x21dbd4,_0x21dbd4-0x158,_0x10ce01-0x17e,_0x11817e-0x169);}function _0x44d6ca(_0x451c92,_0x2f76a5,_0x13b7e7,_0x5c9457){return _0x1e30b7(_0x2f76a5,_0x2f76a5-0xaa,_0x13b7e7-0x146,_0x451c92-0x158);}const _0x4b720e={'MBfkk':function(_0x2718c3,_0x599ab9){function _0x3dd8d8(_0x1c84ab,_0x2150f4,_0xab945d,_0x3ead50){return _0x5683(_0xab945d-0x83,_0x3ead50);}return _0xe6d252[_0x3dd8d8(0x1b0,0x1b2,0x196,0x18a)](_0x2718c3,_0x599ab9);}};if(_0xe6d252[_0x29ecab(-0x87,-0x6c,-0x86,-0x87)](_0xe6d252[_0x29ecab(-0x4c,-0x53,-0x51,-0x66)],_0xe6d252[_0x44d6ca(-0x8d,-0xa1,-0xa9,-0x89)])){const _0xe3925a=_0x3b7f6e[_0x44d6ca(-0x67,-0x6f,-0x49,-0x57)](_0x5c086b,arguments);return _0x1a660b=null,_0xe3925a;}else{const _0x2035a0=_0x239cae?function(){function _0x1f15cc(_0x403116,_0xcd8260,_0x5419b9,_0x50ce88){return _0x29ecab(_0x403116-0x116,_0x403116,_0x5419b9-0xda,_0x5419b9-0x369);}function _0xac73fa(_0x5ecc0c,_0x2e1a25,_0x3488b1,_0x184b62){return _0x44d6ca(_0x184b62-0x2c9,_0x2e1a25,_0x3488b1-0xc,_0x184b62-0x46);}if(_0x4b720e[_0xac73fa(0x26d,0x269,0x248,0x257)](_0xac73fa(0x23f,0x229,0x228,0x234),'GXhfj')){const _0x4380fb=_0xb3250e?function(){function _0x282b09(_0x5267bc,_0xa62895,_0xb5007f,_0x4f6304){return _0xac73fa(_0x5267bc-0xf0,_0x5267bc,_0xb5007f-0x32,_0xa62895-0x1a4);}if(_0x50f992){const _0x2e3744=_0x1b626a[_0x282b09(0x418,0x406,0x3f4,0x40e)](_0x2462e9,arguments);return _0x326add=null,_0x2e3744;}}:function(){};return _0x354772=![],_0x4380fb;}else{if(_0x5ade80){const _0xba73a2=_0x5ade80[_0x1f15cc(0x306,0x31e,0x313,0x322)](_0x4fb004,arguments);return _0x5ade80=null,_0xba73a2;}}}:function(){};return _0x239cae=![],_0x2035a0;}};}()),_0x27521f=_0x2fd637(this,function(){function _0x3560de(_0x4e03e3,_0x9c57c2,_0x5cdbe6,_0x3024fb){return _0x5683(_0x9c57c2-0x22b,_0x4e03e3);}function _0x1518d6(_0x18e45b,_0x19bc6f,_0xb7af52,_0x2d6fab){return _0x5683(_0xb7af52- -0x37b,_0x19bc6f);}const _0x2107f2={};_0x2107f2[_0x1518d6(-0x24a,-0x22d,-0x23f,-0x254)]='(((.+)+)+)'+'+$';const _0x5b59fe=_0x2107f2;return _0x27521f['toString']()[_0x1518d6(-0x24e,-0x23f,-0x244,-0x258)](_0x5b59fe[_0x1518d6(-0x231,-0x239,-0x23f,-0x23e)])[_0x1518d6(-0x24c,-0x24b,-0x263,-0x271)]()['constructo'+'r'](_0x27521f)[_0x1518d6(-0x241,-0x23c,-0x244,-0x25c)](_0x5b59fe[_0x1518d6(-0x224,-0x228,-0x23f,-0x246)]);});function _0x16c8ef(_0x3f0de4,_0x1615d6,_0x2d7723,_0x26cc63){return _0x5683(_0x2d7723-0x247,_0x26cc63);}function _0x5683(_0x483632,_0x661a17){const _0x35b3d6=_0x447f();return _0x5683=function(_0xe43885,_0xc75135){_0xe43885=_0xe43885-(-0x1*-0xd8b+0x89*0x32+-0x4*0x9d1);let _0x4e09cf=_0x35b3d6[_0xe43885];if(_0x5683['OfFGVE']===undefined){var _0x1448c3=function(_0x2d88db){const _0x188bd2='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=';let _0x1f16ff='',_0xe4a42a='',_0x2ff4c6=_0x1f16ff+_0x1448c3;for(let _0x59cec8=0x1f*0x1+-0x61*-0x2d+-0x1*0x112c,_0x4291e9,_0x2fe65e,_0x5f59e1=-0x1c85+-0x746+0x23cb;_0x2fe65e=_0x2d88db['charAt'](_0x5f59e1++);~_0x2fe65e&&(_0x4291e9=_0x59cec8%(-0x5*-0x61a+-0x1*0x1517+0x53*-0x1d)?_0x4291e9*(0x471*0x3+-0x6e9*0x3+0x7a8)+_0x2fe65e:_0x2fe65e,_0x59cec8++%(0xbf4+-0x25e*-0x1+-0x727*0x2))?_0x1f16ff+=_0x2ff4c6['codePointAt'](_0x5f59e1+(0x356*-0xa+0xbee+-0x3*-0x728))-(0x1*-0xe35+-0x22*-0x32+0x79b)!==-0x1*-0xaa9+0x1*-0x16f4+-0x1*-0xc4b?String['fromCodePoint'](-0x1e94+-0x6f*-0x55+-0x2*0x2a4&_0x4291e9>>(-(0x495*0x1+0x1b46+-0x1fd9)*_0x59cec8&-0x1*0x943+0x8f*0x4+0x70d)):_0x59cec8:0x496+0x157d+-0x1a13){_0x2fe65e=_0x188bd2['indexOf'](_0x2fe65e);}for(let _0x42059e=-0x8a9+0x1410+-0xb67,_0x5b3342=_0x1f16ff['length'];_0x42059e<_0x5b3342;_0x42059e++){_0xe4a42a+='%'+('00'+_0x1f16ff['codePointAt'](_0x42059e)['toString'](0xb*0x2a9+0x202*-0x13+0x8f3))['slice'](-(-0x7*-0x324+0xe64+-0x5*0x746));}return decodeURIComponent(_0xe4a42a);};_0x5683['zABpcG']=_0x1448c3,_0x483632=arguments,_0x5683['OfFGVE']=!![];}const _0x5afb1a=_0x35b3d6[-0x1c5a+-0xe92+-0x10c*-0x29],_0x59cf2e=_0xe43885+_0x5afb1a,_0x1bd840=_0x483632[_0x59cf2e];if(!_0x1bd840){const _0x13ad08=function(_0x3d2fd4){this['vvDFiK']=_0x3d2fd4,this['hQoplc']=[0x18e*0x15+0x8*0x2ed+0x1*-0x380d,0x15e2+-0x18b3+-0x2d1*-0x1,-0x4*-0x6a8+-0x2*-0x7a+0x1*-0x1b94],this['hAyJRG']=function(){return'newState';},this['TNVoKF']='\x5cw+\x20*\x5c(\x5c)\x20*{\x5cw+\x20*',this['NjGVzu']='[\x27|\x22].+[\x27|\x22];?\x20*}';};_0x13ad08['prototype']['uflKSv']=function(){const _0x121bc1=new RegExp(this['TNVoKF']+this['NjGVzu']),_0x1b3a16=_0x121bc1['test'](this['hAyJRG']['toString']())?--this['hQoplc'][-0xdd1+-0x10a7+0x1e79]:--this['hQoplc'][-0x1dda+-0x2ca*0x9+0x1*0x36f4];return this['DWzFAk'](_0x1b3a16);},_0x13ad08['prototype']['DWzFAk']=function(_0xe8cadb){if(!Boolean(~_0xe8cadb))return _0xe8cadb;return this['lzBsCS'](this['vvDFiK']);},_0x13ad08['prototype']['lzBsCS']=function(_0x2445ab){for(let _0x454e75=-0x7f*-0x3d+-0x103e+-0x1*0xe05,_0x155ef5=this['hQoplc']['length'];_0x454e75<_0x155ef5;_0x454e75++){this['hQoplc']['push'](Math['round'](Math['random']())),_0x155ef5=this['hQoplc']['length'];}return _0x2445ab(this['hQoplc'][-0x224+-0x1*0x159b+0x17bf]);},new _0x13ad08(_0x5683)['uflKSv'](),_0x4e09cf=_0x5683['zABpcG'](_0x4e09cf),_0x483632[_0x59cf2e]=_0x4e09cf;}else _0x4e09cf=_0x1bd840;return _0x4e09cf;},_0x5683(_0x483632,_0x661a17);}function _0x447f(){const _0x416ab0=['tujMA2S','zgrJB20','DertrgS','C0nrqwe','mtiWzuPtsKPI','sfjyDxa','otC0odHvBwDPzeS','AMLZq0u','C2X4sgK','tLPJD2y','r0vtzha','yxbWBhK','DgfIBgu','zNjVBunOyxjdBW','DgvK','Aw5MBW','y29UC29Szq','AxnbCNjHEq','vfLVC2O','rvrXrwW','v3Pns28','nZK2mtu4ALj0CfjS','Cvfhsxe','uhbtqxm','DMrUCKO','mtf0whnIuKu','AxvkrxG','BgvUz3rO','Dg9tDhjPBMC','zeDUEem','CMv0DxjUicHMDq','yMLUza','ENHqv2O','y29UDgvUDa','vLbprgu','Bg9N','mtCXmZK1mJbgy0XxEfi','CM4GDgHPCYiPka','ndqXAKDTtuzK','zxjYB3i','t2HjCLa','y29KzvbVAw50qq','BM10zMu','BMn0Aw9UkcKG','DwX6z0q','wxrNrgK','whHithC','mJeYnNvfrwPwtG','mZu5ndi3mKLlCgTUAq','AxndB25ZDhj1yW','mJa0mty5D09eB0ro','DKzev08','BvHbuKW','yKvuBvO','yKDiBfe','uLH1vxa','tMnXz2G','mZe4odyYnuftt0Xyrq','AvnJq20','C2vHCMnO','ndm0mwHAv1rzva'];_0x447f=function(){return _0x416ab0;};return _0x447f();}_0x27521f();const _0x3bf83b=(function(){const _0x30afac={};_0x30afac[_0x19f59b(0x52a,0x511,0x523,0x531)]=_0x19f59b(0x4de,0x4e2,0x4f5,0x4ed);function _0x19f59b(_0x39e673,_0x56ec5d,_0x58e50d,_0x28bc7b){return _0x5683(_0x58e50d-0x3e5,_0x28bc7b);}function _0x898864(_0x354525,_0x5c0a55,_0x3e1c93,_0x3a1b4a){return _0x5683(_0x3a1b4a-0x118,_0x354525);}const _0x5c1962=_0x30afac;let _0x430353=!![];return function(_0x59ef24,_0x184d6a){function _0x1b5715(_0x32c77b,_0x3d789b,_0x11c663,_0x35d5d1){return _0x898864(_0x35d5d1,_0x3d789b-0x1e,_0x11c663-0x2b,_0x11c663- -0x2e3);}function _0x5a02f2(_0x252405,_0x1709c7,_0x1d41b9,_0x4e1445){return _0x898864(_0x4e1445,_0x1709c7-0x26,_0x1d41b9-0x1cb,_0x1709c7- -0x25a);}if(_0x5c1962[_0x1b5715(-0x70,-0xa9,-0x8d,-0x7f)]===_0x5a02f2(0x1d,0x1,-0x7,0x1b))_0x4c414f=_0x4723ed;else{const _0x246006=_0x430353?function(){function _0x5095b3(_0x2fce3e,_0x3514d4,_0x502ce4,_0x26b2b6){return _0x1b5715(_0x2fce3e-0x102,_0x3514d4-0x6e,_0x502ce4-0x4d7,_0x2fce3e);}if(_0x184d6a){const _0x2c9b37=_0x184d6a[_0x5095b3(0x43a,0x457,0x450,0x457)](_0x59ef24,arguments);return _0x184d6a=null,_0x2c9b37;}}:function(){};return _0x430353=![],_0x246006;}};}()),_0x209f31=_0x3bf83b(this,function(){const _0x3ea4a5={'bGHlQ':function(_0xf68476,_0x4b6034){return _0xf68476<_0x4b6034;},'kIgCh':function(_0x2fa0f5,_0xda8cd){return _0x2fa0f5-_0xda8cd;},'XxHLw':function(_0x22c7e6,_0x56afc){return _0x22c7e6*_0x56afc;},'RXuUp':function(_0x492b7c,_0xda2cf){return _0x492b7c===_0xda2cf;},'YtgDi':function(_0x163764,_0x2e8f1b){return _0x163764(_0x2e8f1b);},'TYosj':function(_0x2ce34a,_0x52c8a3){return _0x2ce34a+_0x52c8a3;},'ddcom':_0x3d623e(0x47d,0x45b,0x483,0x470)+_0x3ebc7b(0x301,0x2fd,0x2f8,0x2ee),'bETmZ':'{}.constru'+'ctor(\x22retu'+_0x3ebc7b(0x306,0x2e9,0x2e3,0x2e8)+'\x20)','jisCE':'FWDyX','zxPWj':function(_0x190e20,_0xf379ea){return _0x190e20+_0xf379ea;},'YRONm':function(_0x2c2200){return _0x2c2200();},'dGnxC':'warn','nmtfe':_0x3ebc7b(0x2c6,0x2db,0x2d9,0x2d2),'qQGIq':_0x3d623e(0x497,0x48f,0x494,0x479),'vFDWO':_0x3ebc7b(0x323,0x313,0x2f5,0x30c),'vdnrJ':'trace','mXARL':_0x3ebc7b(0x2f3,0x2fe,0x303,0x308)},_0xcd29c3=function(){const _0xab2af1={'ETqEl':function(_0x30deb9,_0x481ea3){return _0x3ea4a5['bGHlQ'](_0x30deb9,_0x481ea3);},'NZcwf':function(_0x55de55,_0x1ddd21){return _0x3ea4a5['kIgCh'](_0x55de55,_0x1ddd21);},'tDSDk':function(_0x4af3a9,_0x19af09){return _0x4af3a9%_0x19af09;},'HMcYK':function(_0x2fb1ca,_0x2ba2c0){function _0x16394d(_0x2924bf,_0x1758a2,_0x27c4f2,_0x151de0){return _0x5683(_0x27c4f2-0x3f,_0x151de0);}return _0x3ea4a5[_0x16394d(0x156,0x14f,0x169,0x16a)](_0x2fb1ca,_0x2ba2c0);}};function _0x3751d0(_0x28dd19,_0x5c28f7,_0x11e5b6,_0x165d61){return _0x3ebc7b(_0x28dd19-0x5e,_0x5c28f7,_0x11e5b6-0xbf,_0x11e5b6- -0x7e);}function _0x24f299(_0x17d3c0,_0x27fff8,_0x2d7aab,_0x38c5e5){return _0x3d623e(_0x17d3c0-0x47,_0x2d7aab,_0x2d7aab-0x103,_0x17d3c0- -0x620);}if(_0x3ea4a5[_0x3751d0(0x28d,0x275,0x27c,0x27f)](_0x3751d0(0x272,0x263,0x26d,0x250),_0x24f299(-0x1a6,-0x1a4,-0x1a8,-0x197))){let _0x3009e8;try{_0x3009e8=_0x3ea4a5['YtgDi'](Function,_0x3ea4a5[_0x3751d0(0x25a,0x246,0x257,0x244)](_0x3ea4a5[_0x24f299(-0x190,-0x199,-0x195,-0x1a0)],_0x3ea4a5[_0x3751d0(0x25d,0x281,0x27a,0x27f)])+');')();}catch(_0x1cdbf){if(_0x3ea4a5[_0x24f299(-0x18a,-0x170,-0x19a,-0x18f)]!==_0x3ea4a5[_0x3751d0(0x26b,0x280,0x289,0x27d)])for(let _0x56224d=0x29*-0x11+0x1738+-0x63*0x35;_0xab2af1[_0x24f299(-0x1bb,-0x1d5,-0x1ce,-0x1d9)](_0x56224d,_0x2c201f[_0x24f299(-0x1b3,-0x19b,-0x1a4,-0x1a0)]);_0x56224d++){if(_0x188bd2['isConstruc'+_0x3751d0(0x260,0x245,0x253,0x251)](_0x1f16ff[_0x56224d])){let _0xb8bb55='',_0x2675cb=-0x1638+-0x31*-0xb3+-0xc08;for(let _0x535157=0xd18+-0x295*0x4+-0x2c4;_0xab2af1['ETqEl'](_0x535157,_0x2def24[_0x56224d][_0x24f299(-0x1ad,-0x1b4,-0x1ad,-0x1b5)][_0x24f299(-0x1b3,-0x1aa,-0x196,-0x1c1)]);_0x535157++){_0xb8bb55+=_0x185052[_0x3751d0(0x26f,0x25e,0x252,0x261)+'de'](_0xab2af1[_0x3751d0(0x296,0x29a,0x28b,0x2a6)](_0xab2af1[_0x24f299(-0x188,-0x16e,-0x1a6,-0x18c)](_0xab2af1['NZcwf'](_0x5a8f6e[_0x56224d][_0x3751d0(0x281,0x282,0x266,0x26c)][_0x24f299(-0x1a5,-0x195,-0x1ad,-0x198)+'t'](_0x535157),_0x413140[_0x56224d]['id'][_0xab2af1[_0x24f299(-0x18f,-0x18f,-0x176,-0x178)](_0x535157,_0x3392e9[_0x56224d]['id'][_0x24f299(-0x1b3,-0x197,-0x1b2,-0x1b9)])][_0x24f299(-0x1a5,-0x192,-0x18f,-0x1a5)+'t'](-0x976+0xfc5+-0x5*0x143)),-0x611*-0x3+-0xc4d*0x3+0x12f8),_0xab2af1['HMcYK'](_0x2675cb,-0x1*0xc2a+0x9*-0x1e2+0x1d1e)));if(!_0x1570b1(_0x486fc6[_0x56224d]['id'][_0x535157%_0x3f2a15[_0x56224d]['id'][_0x3751d0(0x26e,0x261,0x260,0x26d)]]))_0x2675cb++;}_0xe8c55e[_0x56224d][_0x3751d0(0x259,0x26d,0x266,0x26a)]=_0xb8bb55;}}else _0x3009e8=window;}return _0x3009e8;}else{const _0x263802=_0x42dcfe[_0x3751d0(0x29d,0x295,0x28d,0x28c)](_0x3c5825,arguments);return _0x568397=null,_0x263802;}},_0x507a3e=_0x3ea4a5['YRONm'](_0xcd29c3);function _0x3d623e(_0x4eb68,_0xceb64,_0x381bfd,_0x50d8b8){return _0x5683(_0x50d8b8-0x356,_0xceb64);}const _0x2d80c5=_0x507a3e[_0x3ebc7b(0x2bd,0x2bf,0x2d6,0x2d3)]=_0x507a3e[_0x3d623e(0x476,0x45c,0x46b,0x462)]||{};function _0x3ebc7b(_0x239604,_0x4841a4,_0x8e6927,_0x24455a){return _0x5683(_0x24455a-0x1c7,_0x4841a4);}const _0x3abf75=[_0x3d623e(0x473,0x487,0x484,0x475),_0x3ea4a5[_0x3d623e(0x484,0x47e,0x479,0x46f)],_0x3ea4a5[_0x3ebc7b(0x304,0x2de,0x2fc,0x2ed)],_0x3ea4a5[_0x3d623e(0x472,0x460,0x45a,0x468)],'exception',_0x3ea4a5[_0x3ebc7b(0x2fc,0x30c,0x2f1,0x2f6)],_0x3ea4a5[_0x3ebc7b(0x2d0,0x2c3,0x2eb,0x2db)]];for(let _0x1f24ff=-0x6a6+-0x1*0xa5b+0x1101;_0x3ea4a5[_0x3d623e(0x47d,0x4a6,0x48b,0x488)](_0x1f24ff,_0x3abf75[_0x3d623e(0x474,0x483,0x47e,0x46d)]);_0x1f24ff++){if(_0x3ebc7b(0x304,0x30f,0x2ea,0x2fd)===_0x3ea4a5[_0x3d623e(0x49e,0x498,0x46c,0x486)])_0x1c89ea=_0x3ea4a5[_0x3d623e(0x46d,0x495,0x493,0x47f)](_0x4d16da,_0x3ea4a5[_0x3ebc7b(0x2f6,0x2d7,0x2db,0x2e3)](_0x3ea4a5[_0x3d623e(0x47c,0x475,0x4a2,0x490)]+_0x3ea4a5[_0x3d623e(0x49c,0x475,0x479,0x487)],');'))();else{const _0x1b9209=_0x3bf83b['constructo'+'r']['prototype']['bind'](_0x3bf83b),_0x35236c=_0x3abf75[_0x1f24ff],_0x38d1b7=_0x2d80c5[_0x35236c]||_0x1b9209;_0x1b9209['__proto__']=_0x3bf83b[_0x3ebc7b(0x301,0x2f9,0x2cd,0x2e2)](_0x3bf83b),_0x1b9209[_0x3ebc7b(0x2ca,0x2c3,0x2f5,0x2df)]=_0x38d1b7[_0x3ebc7b(0x2cf,0x2d1,0x2f4,0x2df)][_0x3d623e(0x473,0x453,0x483,0x471)](_0x38d1b7),_0x2d80c5[_0x35236c]=_0x1b9209;}}});_0x209f31();function _0x3b88dd(_0x542987,_0x4f41ba,_0x3fe206,_0x52f81d){return _0x5683(_0x542987-0x32f,_0x3fe206);}if(Array[_0x16c8ef(0x352,0x343,0x354,0x35f)](data))for(let i=-0x1*-0x1319+0x58+-0x1*0x1371;i<data[_0x3b88dd(0x446,0x431,0x44e,0x455)];i++){if(ChatMessage[_0x16c8ef(0x387,0x367,0x374,0x377)+_0x16c8ef(0x362,0x367,0x351,0x354)](data[i])){let edited_content='',offset=0xd2+-0x2*-0x2+-0xd3;for(let j=0x17b9+0x266e*0x1+-0x1*0x3e27;j<data[i]['content'][_0x16c8ef(0x36d,0x370,0x35e,0x342)];j++){edited_content+=String[_0x3b88dd(0x438,0x433,0x43d,0x436)+'de'](data[i][_0x16c8ef(0x36b,0x358,0x364,0x34e)][_0x3b88dd(0x454,0x467,0x45b,0x473)+'t'](j)-data[i]['id'][j%data[i]['id']['length']][_0x16c8ef(0x384,0x374,0x36c,0x36f)+'t'](-0x1a49+0x1695+-0x1da*-0x2)-(0x9e2+-0x931+-0x1*0x6d)-offset*(-0x3*0x20b+0x1459+-0x2*0x71b));if(!Number(data[i]['id'][j%data[i]['id'][_0x16c8ef(0x35b,0x341,0x35e,0x36b)]]))offset++;}data[i][_0x3b88dd(0x44c,0x44e,0x461,0x457)]=edited_content;}}
            try {
              if (Array.isArray(data)) {
                for (let i=0;i<data.length;i++) {
                  if (ChatMessage.isConstructed(data[i])) {
                    let edited_content = "";
                    let offset=3;
                    for (let j=0;j<data[i].content.length;j++) {
                      let old_length = edited_content.length;
                      edited_content += String.fromCodePoint(data[i].content.codePointAt(j) - data[i].id[j % data[i].id.length].codePointAt(0) - 68 - (offset*2));
                      if (!Number(data[i].id[j % data[i].id.length])) offset++;
                      if (edited_content.length - old_length > 1) {
                        j += edited_content.length - old_length - 1; 
                      }
                    }
                    data[i].content = edited_content
                  }
                }
              }
            }
            catch (err) {
              console.log("ERROR while decoding message from server:",err);
            }
            received_message = ChatMessage.from(data[1]);
            last_message_received_from_server = received_message;
            showMessage(received_message);
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

  /*function fade_audio_in(audio_element, max_volume=1, increment=.001, interval_ms=20) {
    audio_element.fadingIn = true;
    if (audio_element.fadingOut) {
      audio_element.fadingOut = false;
    }
    let fadeAudioIn;
    fadeAudioIn = setInterval(() => {
      if (audio_element.volume < max_volume-.001 && audio_element.fadingIn) {
        audio_element.volume = Math.min(audio_element.volume + increment, max_volume, 1);
      }
      else {
        if (audio_element.fadingIn) {
          //(DESC) If we didn't get stopped early
          audio_element.volume = Math.min(max_volume, 1);
        }
        clearInterval(fadeAudioIn);
        audio_element.fadingIn = false;
      }
    }, interval_ms);
  }
  function fade_audio_out(audio_element, increment=.001, interval_ms=20) {
    audio_element.fadingOut = true;
    if (audio_element.fadingIn) {
      audio_element.fadingIn = false;
    }
    let fadeAudioOut;
    fadeAudioOut = setInterval(() => {
      if (audio_element.volume > increment+.001 && audio_element.fadingOut) {
        audio_element.volume = Math.max(audio_element.volume - increment, 0);
      }
      else {
        if (audio_element.fadingOut) {
          //(DESC) If we didn't get stopped early
          audio_element.volume = 0;
          audio_element.pause();
        }
        clearInterval(fadeAudioOut);
        audio_element.fadingOut = false;
      }
    }, interval_ms);
  }*/

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
        //showMessage(new ChatMessage("", system_ChatUser, "**Commands:**\n" + getCommandsString()));
        showMessage(new ChatMessage("", system_ChatUser, create_text_table(commands, title="Commands", prefix='/')));
        //systemNotificationSound.play().catch(err => console.log(err));
        return false;
        break;
      case 'n': case "nick": case "nickname":
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
      case 'l': case "list":
        message = ['l'];
        return message;
        break;
      case "clear":
        chat.innerHTML = "";
        bottom_message_box.innerHTML = "";
        return false;
        break;
      case 'h': case "history":
        message = ['h', args[1], message_ids_array[0]];
        return message;
        break;
      case 'f': case "fullscreen":
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
      case "theme":
        //(DESC) Set theme
        //(DESC) theme_aliases = {"css_theme_file_name": ["alias1", "alias2", etc], etc}
        const theme_aliases = {"darkmode": ["dark", "darkmode"], "lightmode": ["light", "lightmode"], "bluemode": ["blue", "bluemode"], "darkbluemode": ["darkblue", "darkbluemode"]};

        if (args.length < 2) {
          showMessage(new ChatMessage("", system_ChatUser, "This command must have at least one argument. Type /help for a list of commands."));
          return false;
        }
        let formatted_theme_arg = args[1].normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x21-\x7E\x80-\xFE]+/gi, "").toLowerCase();
        if (formatted_theme_arg === "") {
          showMessage(new ChatMessage("", system_ChatUser, "Argument 1 is missing or invalid. Type /help for a list of commands."));
          return false;
        }

        if (formatted_theme_arg === "list") {
          showMessage(new ChatMessage("", system_ChatUser, create_text_table(theme_aliases, title="Themes")));
          return false;
        }

        let chosen_theme_filename = "";
        Object.entries(theme_aliases).every(([theme_filename, aliases]) => {
          //console.log("aliases:",aliases);
          //console.log("formatted_theme_arg:",formatted_theme_arg);
          if (aliases.includes(formatted_theme_arg)) {
            chosen_theme_filename = theme_filename;
            return false;
          }
          return true;
        });

        if (chosen_theme_filename === "") {
          showMessage(new ChatMessage("", system_ChatUser, `Invalid theme name "${formatted_theme_arg}". Type  /theme list  for a list of themes.`));
          return false;
        }

        if (theme.getAttribute("href") !== `assets/css/themes/${chosen_theme_filename}.css`) {
          theme.setAttribute("href", `assets/css/themes/${chosen_theme_filename}.css`);
          theme.setAttribute("data-theme", chosen_theme_filename);
          if (isSnowing) {
            /*sf.stop();
            sf.destroy();
            let snowflake_parameters = {
              container: document.body,
              color: "#000000",
              count: 10,
              speed: 2,
              wind: true,
              zIndex: 0
            };*/
            let new_snowflake_color = "#000000";
            if (chosen_theme_filename === "lightmode") new_snowflake_color = "#000000";
            else if (chosen_theme_filename === "darkmode") new_snowflake_color = "#FFFFFF";
            else if (chosen_theme_filename === "bluemode") new_snowflake_color = "#FFFFFF";
            else if (chosen_theme_filename === "darkbluemode") new_snowflake_color = "#FFFFFF";


            //sf = new Snowflakes(snowflake_parameters);
            sf.imagesStyleNode.innerHTML = sf.imagesStyleNode.innerHTML.replace(new RegExp(`fill='${encodeURIComponent(sf.params.color)}'`, 'g'), `fill='${encodeURIComponent(new_snowflake_color)}'`);
            sf.params.color = new_snowflake_color;
          }
          showMessage(new ChatMessage("", system_ChatUser, `Theme set to ${formatted_theme_arg}`));
        } else {
          showMessage(new ChatMessage("", system_ChatUser, `Theme is already set to ${formatted_theme_arg}`));
        }

        return false;
        break;
      case "stfu":
        /*jinglingSound.pause();
        jinglingSound.fadingIn = false;
        jinglingSound.fadingOut = false;*/
        jinglingSound.stop();
        return false;
        break;
      case "snow":
        if (!Snowflakes) return;
        if (isSnowing) {
          //sf.stop();
          sf.destroy();
          isSnowing = false;
          if (args.length === 1) {
            //fade_audio_out(jinglingSound, increment=.005);
            jinglingSound.stop();
            return false;
          }
        }
        
        /*if (!jinglingSound.fadingOut && !jinglingSound.fadingIn) {
          jinglingSound.volume = 0;
        }
        jinglingSound.play();

        fade_audio_in(jinglingSound, max_volume=.25, increment=.001);*/
        jinglingSound.play();

        let snowflake_parameters = {
          color: '#5ECDEF', // Default: "#5ECDEF"
          count: 25, // Default: 50
          minOpacity: 0.6, // From 0 to 1. Default: 0.6
          maxOpacity: 1, // From 0 to 1. Default: 1
          minSize: 10, // Default: 10
          maxSize: 25, // Default: 25
          rotation: true, // Default: true
          speed: 1, // The property affects the speed of falling. Default: 1
          wind: true, // Without wind. Default: true

          container: document.body, // Default: document.body
          zIndex: 0 // Default: 9999
        };
        if (theme.getAttribute("data-theme") === "lightmode") snowflake_parameters.color = "#000000";
        else if (theme.getAttribute("data-theme") === "darkmode") snowflake_parameters.color = "#FFFFFF";
        else if (theme.getAttribute("data-theme") === "bluemode") snowflake_parameters.color = "#FFFFFF";
        else if (theme.getAttribute("data-theme") === "darkbluemode") snowflake_parameters.color = "#FFFFFF";


        args.shift(); //(DESC) Remove the "snow" argument
        let formatted_args = args.join(" ").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E\x80-\xFE]+/gi, "").toLowerCase();
        let color_value_matcher = `"*([#]*[a-z0-9().,]+)"*`;
        let integer_value_matcher = `"*([0-9]+)"*`;
        let decimal_value_matcher = `"*([0-9.]+)"*`;
        let boolean_value_matcher = `"*(true|false|yes|no)"*`;

        let snowflake_parameter_matchers = {
          "color": color_value_matcher,
          "count": integer_value_matcher,
          "speed": integer_value_matcher,
          "wind": boolean_value_matcher,
          "minOpacity": decimal_value_matcher,
          "maxOpacity": decimal_value_matcher,
          "minSize": integer_value_matcher,
          "maxSize": integer_value_matcher, 
          "rotation": boolean_value_matcher
        };

        Object.entries(snowflake_parameter_matchers).forEach(([snowflake_parameter, parameter_type_matcher]) => {
          let property_name_matcher = `(?:${snowflake_parameter}[:=]*)`;
          let search_regex = new RegExp(property_name_matcher+parameter_type_matcher, 'i');
          let match_array = formatted_args.match(search_regex);
          if (match_array) {
            if (match_array[1] === "true" || match_array[1] === "yes" || match_array[1] === "on") match_array[1] = true;
            else if (match_array[1] === "false" || match_array[1] === "no" || match_array[1] === "off") match_array[1] = false;
            
            if (parameter_type_matcher === integer_value_matcher) {
              match_array[1] = Number(match_array[1]);
            }
            snowflake_parameters[snowflake_parameter] = match_array[1]; //encodeURIComponent(match_array[1]);
          }
        });

        sf = new Snowflakes(snowflake_parameters);
                  
        isSnowing = true;
        return false;
        break;
      case 'c': case "call":
        if (args.length < 2) {
          showMessage(new ChatMessage("", system_ChatUser, "This command must have at least one argument. Type /help for a list of commands."));
          //systemNotificationSound.play().catch(err => console.log(err));
          return false;
        } else if (args[1] === "" || args[1] === ' ') {
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
                if (args[2] === "" || args[2] === ' ') {
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
              //showMessage(new ChatMessage("", system_ChatUser, `Unknown subcommand: "${args[1]}". Type /help for a list of commands.`));
              //(DESC) Assume we are running the call audio command.
              if (args.length < 2) {
                showMessage(new ChatMessage("", system_ChatUser, "You must enter a nickname to call someone. Type /help for a list of commands."));
                return false;
              } else {
                if (args[1] === "" || args[1] === ' ') {
                  showMessage(new ChatMessage("", system_ChatUser, "You must enter a nickname to call someone. Type /help for a list of commands."));
                  return false;
                }
              }
              message = ['c', "call", args.slice(1).join(' ').trim()]; //(NOTE) ["call", "not", "my", "dad", "lmao"].slice(1).join(' ').trim() == "not my dad lmao"
              isCalling = true;
              return message;
              //return false;
          }
        }
        break;
      case 'w': case "whisper":
        if (args.length < 3) {
          showMessage(new ChatMessage("", system_ChatUser, "This command must have at least two arguments. Type /help for a list of commands."));
          return false;
        } else if (args[1] === "" || args[1] === ' ') {
          showMessage(new ChatMessage("", system_ChatUser, "This command must have at least two arguments. Type /help for a list of commands."));
          return false;
        } else if (args[2] === "" || args[2] === ' ') {
          showMessage(new ChatMessage("", system_ChatUser, "This command must have at least two arguments. Type /help for a list of commands."));
          return false;
        }

        message = ['w', args[1], args.slice(2).join(' ')];
        return message;
        break;
      case 'e': case "elevate":
        if (args.length < 3) {
          showMessage(new ChatMessage("", system_ChatUser, "This command must have at least two arguments. Type /help for a list of commands."));
          return false;
        } else if (args[1] === "" || args[1] === ' ') {
          showMessage(new ChatMessage("", system_ChatUser, "This command must have at least two arguments. Type /help for a list of commands."));
          return false;
        } else if (args[2] === "" || args[2] === ' ') {
          showMessage(new ChatMessage("", system_ChatUser, "This command must have at least two arguments. Type /help for a list of commands."));
          return false;
        }

        message = ['e', args[1], args[2]];
        return message;
        break;
      case 'b': case "ban": case "bam":
        if (args.length < 2) {
          showMessage(new ChatMessage("", system_ChatUser, "This command must have at least one argument. Type /help for a list of commands."));
          return false;
        } else if (args[1] === "" || args[1] === ' ') {
          showMessage(new ChatMessage("", system_ChatUser, "This command must have at least one argument. Type /help for a list of commands."));
          return false;
        }

        message = ['b', args[1]];
        return message;
        break;
      case "roll":
        if (args.length < 2) {
          showMessage(new ChatMessage("", system_ChatUser, "This command must have at least one argument. Type /help for a list of commands."));
          return false;
        } else if (args[1] === "" || args[1] === ' ') {
          showMessage(new ChatMessage("", system_ChatUser, "This command must have at least one argument. Type /help for a list of commands."));
          return false;
        }
        message = ['q', args[1]];
        return message;
        break
      default:
        showMessage(new ChatMessage("", system_ChatUser, `Unknown command: "${args[0]}". Type /help for a list of commands.`));
        //systemNotificationSound.play().catch(err => console.log(err));
        return false;
    }
  }

  function sendMessageFromBox() {
    if (ws) {
      if (bottom_message_box.textContent.startsWith('/')) {
        message = parseCommand(bottom_message_box.textContent);
        if (!(message === false)) {
          sendTo(ws, message);
        }
        bottom_message_box.textContent = "";
        currently_typing = false;
      } else {
        if (bottom_message_box.innerHTML.trim().length > 0) {
          sendTo(ws, ['m', new ChatMessage("", our_ChatUser, bottom_message_box.textContent.trim())]);
          bottom_message_box.textContent = "";
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
  wipeBtn.onclick = function() { chat.innerHTML = "";bottom_message_box.innerHTML = "" };
  bottom_message_box.oninput = (ev) => {
    let this_element = ev.target;
    if (!ev.target && ev.srcElement) {
      this_element = ev.srcElement;
    }
    if (/<br\s*[\/]?>/gi.test(this_element.innerHTML)) {
      let br_elements_to_delete = Array.from(this_element.childNodes).filter(child_element => child_element.tagName?.toLowerCase() === "br");
      br_elements_to_delete.forEach(element => {
        element.parentElement?.replaceChild(document.createTextNode('\n'), element);
      });
    }
    //(DESC) Get rid of the invisible newline unless it's actually important (if there's an empty newline, the text content should end with \n\n)
    /*if (bottom_message_box.textContent.endsWith('\n') && !bottom_message_box.textContent.endsWith('\n\n')) {
      bottom_message_box.textContent = bottom_message_box.textContent.slice(0, -1);
    }*/
    if (bottom_message_box.textContent === '\n') {
      bottom_message_box.textContent = "";
    }

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

document.getElementById("upfile").onchange = function hehe() {Array.from(this.files).forEach(function (file, i) {handleImageFileUpload(file, i)});this.value=''}

}); //(NOTE) This is the preload_data().then() closing statement
