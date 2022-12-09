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

//(DESC) GETs data from the server and returns the JSON response
async function get_data(url, headers={}) {
  response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      ...headers
    },
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

  //(DESC) Get svg icons
  preloaded.icons = await (await fetch("assets/data/icons.json")).json();

  //(DESC) Set api url
  let domain = getDomain(location.host);
  let api_url_properties = {
    protocol: location.protocol,
    host: domain,
    path: "",
  }
  if (preloaded.config.supported_external_domains.includes(domain)) {
    api_url_properties.host = preloaded.config.ngrok_url;
  }
  preloaded.api_url = `${api_url_properties.protocol}//${api_url_properties.host}${api_url_properties.path}`;

  //(DESC) Check if there is a token in localstorage
  if (localStorage.getItem("token")) {
    let auth_url = `${preloaded.api_url}/auth`;

    let server_response = await submit_data(`${auth_url}/token`, {token: localStorage.getItem("token")});
    if (server_response.hasOwnProperty("error")) {
      //(DESC) Server sent us an error (token is probably invalid). Go back to the login page.
      location.replace(`${location.protocol}//${location.host}/login`);
      return false; //(NOTE) Should never be run
    }

    preloaded.our_ChatUser = server_response.user;
  } else {
    //(DESC) There isn't a login token in localStorage. Go back to the login page.
    location.replace(`${location.protocol}//${location.host}/login`);
    return false; //(NOTE) Should never be run
  }

  return preloaded;
};

preload_data().then((preloaded) => {
if (!preloaded) return; //(NOTE) This is just here to stop the function if it's running ahead of the above location.replace (preloaded returns a boolean, true means continue, false means stop)

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
  static setAttributes(element, attributes_object) {
    Object.entries(attributes_object).forEach(([attribute_name, attribute_value]) => {
      element.setAttribute(attribute_name, attribute_value);
    });
  }

  static setAttributesNS(attribute_namespace, element, attributes_object) {
    Object.entries(attributes_object).forEach(([attribute_name, attribute_value]) => {
      element.setAttributeNS(attribute_namespace, attribute_name, attribute_value);
    });
  }

  static insertAfter(newNode, existingNode) {
    try {
      existingNode.parentNode.insertBefore(newNode, existingNode.nextSibling);
      return true;
    }
    catch (err) {
      console.log("ERROR: Styler: insertAfter: Could not insert newNode into existingNode.parentNode before existingNode.nextSibling.  Error message:",err);
      return false;
    }
  }

  static insertText(element, string_to_insert) {
    try {
      element.appendChild(document.createTextNode(string_to_insert));
      return true;
    }
    catch (err) {
      console.log("ERROR: Styler: insertText: Could not insert text node into element.  Error message:",err);
      return false;
    }
  }

  static create_element(tagname, attributes={}, parent_element=null) {
    let new_element;
    if (tagname === "svg" || tagname === "path" || parent_element?.namespaceURI === "http://www.w3.org/2000/svg") { //if (attributes.hasOwnProperty("xmlns") || parent_element?.hasOwnProperty("xmlns")) {
      let new_namespaceURI = attributes["xmlns"] || parent_element.namespaceURI;
      new_element = document.createElementNS(new_namespaceURI, tagname);
    }
    else {
      new_element = document.createElement(tagname);
    }

    Styler.setAttributes(new_element, attributes);
    
    if (parent_element) parent_element.appendChild(new_element);
    return new_element;
  }

  static create_icon(icon_name, attributes={}, parent_element=null) {
    const ns = "http://www.w3.org/2000/svg";

    let icon_definition = preloaded.icons[icon_name];
    if (icon_definition === undefined) {
      console.log("ERROR: Styler: create_icon: No icon found with given name")
      icon_definition = preloaded.icons["default"]; //return false;
    }

    let icon_children_definitions_array = icon_definition["children"];
    delete icon_children_definitions_array["children"]; 

    let icon_attributes = {...icon_definition, ...attributes};

    if (icon_attributes.hasOwnProperty("children")) delete icon_attributes["children"]; //(DESC) Remove the "children" property from icon_definition so that we can treat the rest of the properties of icon_definition as attributes of the new_icon_element
    
    let new_icon_element = document.createElementNS(ns, "svg");
    Styler.setAttributes(new_icon_element, icon_attributes);

    icon_children_definitions_array.forEach(({tag, attributes: icon_child_attributes}) => {
      let new_icon_child_element = document.createElementNS(ns, tag);
      Styler.setAttributes(new_icon_child_element, icon_child_attributes);
      new_icon_element.appendChild(new_icon_child_element);
    });

    if (parent_element) parent_element.appendChild(new_icon_element);

    return new_icon_element;
  }

  static insertSeparator(element, placeholder_text=" ") {
    let separator_element = Styler.create_element("i", {}, element);
    Styler.insertText(separator_element, placeholder_text);
    
    return separator_element;
  }

  /*static create_message_edit_indicator(edited_timestamp) {
    //<div class="edit_indicator" style="display: inline-block;position: relative;margin-left: 4px;font-size: 12px;opacity:0.75;pointer-events: none;user-select: none" contenteditable="false">
    //  (edited)
    //</div>
    let edited_timestamp_date = new Date(edited_timestamp);
    let formatted_edited_time_string = edited_timestamp_date.toDateString()+' '+edited_timestamp_date.toLocaleTimeString();

    let message_edit_indicator_element = Styler.create_element("div", {class: "edit_indicator", title: formatted_edited_time_string});

    return message_edit_indicator_element
  }*/

  static create_message_reply(reply_message, reply_user_type) {
    let message_reply_element = Styler.create_element("div", {class: "message_reply"});
    let message_reply_badge_element = Styler.create_element("div", {class: "message_reply_badge"}, message_reply_element);
    Styler.create_icon("message_reply_badge", {class: "SVGIcon-icon"}, message_reply_badge_element);
    let message_reply_username_element = Styler.create_element("span", {class: "username "+reply_user_type}, message_reply_element);
    Styler.insertText(message_reply_username_element, reply_message.author.username);
    let message_reply_content_element = Styler.create_element("div", {class: "message_content", "data-reply_id": reply_message.id}, message_reply_element);
    Styler.insertText(message_reply_content_element, reply_message.content);

    return message_reply_element;
  }

  static create_message_reply_placeholder(placeholder_text) {
    let message_reply_element = Styler.create_element("div", {class: "message_reply"});
    let message_reply_badge_element = Styler.create_element("div", {class: "message_reply_badge"}, message_reply_element);
    Styler.create_icon("message_reply_badge", {class: "SVGIcon-icon"}, message_reply_badge_element);
    
    if (placeholder_text !== null && placeholder_text !== undefined) {
      let message_reply_placeholder_element = Styler.create_element("div", {class: "message_reply_placeholder"}, message_reply_element);
      Styler.insertText(message_reply_placeholder_element, placeholder_text);
    }

    return message_reply_element;
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
    function get_target_chat_message_element_from_event(ev) {
      for (let i=0;i<ev.path.length;i++) {
        if (ev.path[i].parentElement?.id === chat.id && ev.path[i].classList?.contains("chat_message")) { //(CODE) && !(ev.path[i].getAttribute("data-type") === "sys")) {
          let target_chat_message_element = ev.path[i];
          return target_chat_message_element;
          break;
        }
        if (i === ev.path.length-1) {
          console.log("ERROR: get_target_chat_message_element_from_event: could not get chat message element");
          return false;
        }
      }
    }

    const reply_handler        = (ev) => {
      //showMessage(new ChatMessage("", system_ChatUser, "Replies aren't ready yet :sob:"));
      //return false;
      //(DESC) Remove reply bar if it already exists
      if (document.getElementById("reply_bar") !== null) {
        let reply_bar = document.getElementById("reply_bar");
        reply_bar.parentElement?.removeChild(reply_bar);
        reply_bar.remove();
      }


      let target_chat_message_element = get_target_chat_message_element_from_event(ev);
      if (target_chat_message_element === false) {
        console.log("ERROR: reply_handler: Could not get chat message element");
        return false;
      }

      let target_chat_message_username_element;
      try {
        target_chat_message_username_element = target_chat_message_element.querySelector(".message_header > .username");
      }
      catch(err) {
        console.log("ERROR: reply_handler: Could not get target_chat_message_username_element.  Error message:",err);
        return false;
      }

      let target_chat_message_username = target_chat_message_username_element.textContent.slice(0, -1); //(NOTE) .slice(0, -1) to take the space off the end of the username



      //(DESC) Highlight the message that we are replying to
      target_chat_message_element.classList.add("replying_to_chat_message");


      //(DESC) Create reply bar
      let reply_bar = Styler.create_element("div", {id: "reply_bar", class: "reply_bar"});

      let reply_bar_label = Styler.create_element("div", {class: "reply_bar_label"}, reply_bar);
      Styler.insertText(reply_bar_label, "Replying to ");
      let reply_bar_label_username = Styler.create_element("span", {class: target_chat_message_username_element.className}, reply_bar_label);
      Styler.insertText(reply_bar_label_username, target_chat_message_username);

      let reply_bar_close_button = Styler.create_element("button", {class: "reply_bar_close_button"}, reply_bar);
      let reply_bar_close_button_icon = Styler.create_icon("reply_bar_close_button", {class: "SVGIcon-icon"}, reply_bar_close_button);

      //(DESC) Insert the reply_bar element after the is_typing_box
      Styler.insertAfter(reply_bar, document.getElementById("is_typing_box"));
      isReplying = true;
      

      //(DESC) remove the "replying_to_chat_message" class when the target_chat_message_element is removed
      new MutationObserver(function (ev, observer) {
        if (ev[0].removedNodes?.forEach(removed_node => {
          if (removed_node === reply_bar) {
            target_chat_message_element.classList.remove("replying_to_chat_message");
            //isReplying = false;
            observer.disconnect();
          }
        }));
      }).observe(reply_bar.parentElement, { childList: true });;
      
      const remove_reply_bar_if_exists = () => {
        if (document.body.contains(reply_bar)) {
          isReplying = false;
          reply_bar.parentElement?.removeChild(reply_bar);
          reply_bar.remove();
        }
      }

      //(DESC) click, enter, and escape functions
      addSelfDestructingEventListener(document, "keydown", (ev) => {
        key_code = cross_browser_keycode(ev);
        if (key_code === 27 || key_code === "Escape") { //(NOTE) Escape
          remove_reply_bar_if_exists();
          return true; //(NOTE) self destruct event listener
        }
      });
      reply_bar_close_button.onclick = (ev) => {
        remove_reply_bar_if_exists();
        ev.preventDefault();
      }
    }
    const edit_handler         = (ev) => {
      //showMessage(new ChatMessage("", system_ChatUser, "Editing isn't ready yet :sob:"));
      //return false;
      let target_chat_message_element = get_target_chat_message_element_from_event(ev);
      if (target_chat_message_element === false) {
        console.log("ERROR: edit_handler: could not get chat message element");
        return false;        
      }
      target_chat_message_element.setAttribute("data-no-quickactionbar", true);
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
          return true; //(NOTE) self destruct event listener
        }
      });
      EditHelper_cancel_action.onclick = (ev) => {
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
      let target_chat_message_element = get_target_chat_message_element_from_event(ev);
      if (target_chat_message_element === false) {
        console.log("ERROR: copy_id_handler: could not get chat message element");
        return false;
      }
      copyTextToClipboard(target_chat_message_element.id);
      showMessage(new ChatMessage("", system_ChatUser, "Message id copied!!"));
      return true;
    }
    const delete_handler       = (ev) => {
      //(TODO) Add a prompt before deleting messages

      //showMessage(new ChatMessage("", system_ChatUser, "Message deleting isn't ready yet :sob:"));
      //return false;
      let target_chat_message_element = get_target_chat_message_element_from_event(ev);
      if (target_chat_message_element === false) {
        console.log("ERROR: delete_handler: could not get chat message element");
        return false;
      }
      sendTo(ws, ['x', target_chat_message_element.id]);
      return true;
    }
    const context_menu_handler = (ev) => {
      document.documentElement.style.setProperty('--shift-not-pressed-visibility-flex', 'none');
      document.documentElement.style.setProperty('--shift-pressed-visibility-flex', 'flex');
      return false;
    }
    const actions = { 
      "reply": {
        "description": "Reply",
        "handler": reply_handler,
        "icon_name": "reply_action"
      },
      "edit": {
        "description": "Edit",
        "handler": edit_handler,
        "icon_name": "edit_action"
      },
      "share": {
        "description": "Share message",
        "handler": share_handler,
        "icon_name": "share_action"
      },
      "copy-link": {
        "description": "Copy message link",
        "handler": copy_link_handler,
        "icon_name": "copy_link_action"
      },
      "pin": {
        "description": "Pin message",
        "handler": pin_handler,
        "icon_name": "pin_action"
      },
      "quote": {
        "description": "Quote",
        "handler": quote_handler,
        "icon_name": "quote_action"
      },
      "copy-id": {
        "description": "Copy message id",
        "handler": copy_id_handler,
        "icon_name": "copy_id_action"
      },
      "delete": {
        "description": "Delete",
        "handler": delete_handler,
        "icon_name": "delete_action"
      },
      "context-menu": {
        "description": "Show more",
        "handler": context_menu_handler,
        "icon_name": "context_menu_action"
      }
    }

    let QuickActionBar = Styler.create_element("div", {class: "QuickActionBar"}, element); //(CODE) const QuickActionBar = Styler.create_element("div", {}, element);
    element.setAttribute("data-hasquickactionbar", true);

    function add_action(action_name, additional_wrapper_classes="") {
      let action_wrapper = Styler.create_element("div", {class: "QuickActionBar-action-wrapper "+additional_wrapper_classes, title: actions[action_name].description, "data-name": action_name}, QuickActionBar);
      let action = Styler.create_element("div", {class: "QuickActionBar-action"}, action_wrapper);
      let action_icon = Styler.create_icon(actions[action_name].icon_name, {class: "SVGIcon-icon"}, action);
      /*
      let action_icon = Styler.create_element("svg", {
        class: "SVGIcon-icon", 
        "shape-rendering": "geometricPrecision",
        "role": "img",
        "xmlns": "http://www.w3.org/2000/svg",
        "viewBox": actions[action_name].icon.viewBox
      }, action);
      let icon_path = Styler.create_element("path", actions[action_name].icon.path, action_icon);
      */
      
      action_wrapper.addEventListener("click", actions[action_name].handler);
      //(CODE) return action_wrapper; //(NOTE) Currently unused
    }
    

    if (element.getAttribute("data-type") === "sys") {
      //add_action("copy-link", "shift-pressed");
      //add_action("quote", "shift-pressed");
      add_action("copy-id", "shift-pressed");
      add_action("context-menu", "separator-left");
    }
    else if (element.getAttribute("data-type") === "you") {
      add_action("reply", "shift-pressed");
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
      add_action("reply");
      add_action("reply", "shift-pressed");
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
                try { element.removeChild(QuickActionBar) } catch(err){console.log("ERROR:",err)};
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
          try { element.removeChild(QuickActionBar) } catch(err){console.log("ERROR:",err)};
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

  static get constructor_properties() {
    let properties_of_constructor = [
      "id"
    ];
    return properties_of_constructor;
  }

  constructor(id = Base.new_client_snowflake) {
    this.id = id;
  }

  //(DESC) Generates a snowflake that is ALWAYS different from the server's snowflakes (its worker id is 0, which is reserved for internal client communication)
  static #snowflake_increment_id = 0n;
  static get new_client_snowflake() {
    let timestamp = BigInt(Date.now());
  
    let snowflake = (timestamp << 22n) + this.#snowflake_increment_id;
    if (this.#snowflake_increment_id < 0b111111111111) {
      this.#snowflake_increment_id += 1n;
    }
    else {
      this.#snowflake_increment_id = 0n;
    }
  
    return snowflake.toString(10);
  }

  //(DESC) Generate a token from a snowflake
  static generate_token(snowflake) {
    //(TODO) Create browser-compatable version
    console.log("The generate_token function is only available on the server.");
    return false;
  }

  //(DESC) Generate a token from this class's id
  get new_token() {
    return Base.generate_token(this.id);
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
    return Base.getTimestamp(this.id);
  }

  static getTimestamp(id) {
    return (BigInt(id) >> 22n).toString(10);
  }

  static parsePotentialClass(object_or_json_string) {
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
    else {
      console.log("ERROR: cheese: parsePotentialClass: object_or_json_string is of an invalid type!!");
      console.log("object_or_json_string:",object_or_json_string);
      return false;
    }

    if (typeof object === "object" && object !== null) { //(CODE) if (typeof object === "object" && this.isValid(object)) {
      return object;
    }
    else {
      console.log("ERROR: Could not create new class instance from object");
      return false; //(DESC) Object was invalid, did not create new class instance
    }
  }

  static from(object_or_json_string) {
    //console.log("INFO: cheese: Base: object_or_json_string:",object_or_json_string);
    let potential_class_object = this.parsePotentialClass(object_or_json_string);
    //console.log("INFO: cheese: Base: potential_class_object:",potential_class_object);
    if (potential_class_object === false) {
      console.log("ERROR: parsePotentialClass could not parse object_or_json_string!!!");
      return false;
    }
    // else...
    //(TODO) Find a way to make this less ugly.
    let trimmed_potential_class_object = {};
    this.constructor_properties.forEach(constructor_property => {
      if (potential_class_object.hasOwnProperty(constructor_property)) {
        trimmed_potential_class_object[constructor_property] = potential_class_object[constructor_property];
      }
    });

    if (this === Base || Object.getPrototypeOf(this) === Base) {
      return Object.assign(new this(), trimmed_potential_class_object);
    }
    else {
      console.log("ERROR: (Base).from:  this  is not an instance of any known Base classes!!!");
      return trimmed_potential_class_object;
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

class ChatChannel extends Base {
  static get constructor_properties() {
    let properties_of_constructor = [
      "id",
      "type",
      "typing_user_ids",
      "pinned_message_ids",
      "first_message_id",
      "last_message_id"
    ];
    return properties_of_constructor;
  }

  constructor(id = "", type = 0, pinned_message_ids = [], typing_user_ids = [], first_message_id = "", last_message_id = "") {
    super((id) ? id : undefined);
    this.type = type;
    this.typing_user_ids = typing_user_ids || [];
    this.pinned_message_ids = pinned_message_ids;
    this.first_message_id = first_message_id;
    this.last_message_id = last_message_id;
  }

  static isConstructed(channel) {
    let is_constructed = true;

    try {
      if (!Base.isConstructed(channel)) is_constructed = false;
      else if (!channel?.hasOwnProperty("type")) is_constructed = false;
      else if (!channel?.hasOwnProperty("typing_user_ids")) is_constructed = false;
      else if (!channel?.hasOwnProperty("pinned_message_ids")) is_constructed = false;
      else if (!channel?.hasOwnProperty("first_message_id")) is_constructed = false;
    }
    catch (err) {
      console.log("ERROR:",err);
      is_constructed = false;
    }

    return is_constructed;
  }

  static isValid(channel) {
    let is_valid = true;

    try {
      if (!Base.isValid(channel)) is_valid = false;
      //(TODO) Be less tired
      if (!ChatChannel.isConstructed(channel)) is_valid = false;
    }
    catch (err) {
      console.log("ERROR:",err);
      is_valid = false;
    }

    return is_valid;
  }
}

class ChatUser extends Base {
  //id; //(TYPE) Snowflake {string}
  username = ""; //(TYPE) string
  permissions = 0; //(DESC) Elevation level //(TYPE) number

  static get constructor_properties() {
    let properties_of_constructor = [
      "id",
      "username",
      "permissions"
    ];
    return properties_of_constructor;
  }

  constructor(id = "", username = "", permissions = 0) {
    super((id) ? id : undefined);
    this.username = username;
    this.permissions = permissions;
  }

  static isConstructed(user) {
    let is_constructed = true;

    try {
      if (!Base.isConstructed(user)) is_constructed = false;
      else if (!user?.hasOwnProperty("username")) is_constructed = false;
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
      else if (typeof user?.username !== "string" || user?.username.trim() === "") is_valid = false;
      //else if (typeof user?.permissions !== "number") is_valid = false;
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

  static get constructor_properties() {
    let properties_of_constructor = [
      "id",
      "author",
      "content",
      "reply",
      "edited"
    ];
    return properties_of_constructor;
  }

  constructor(id = "", author = new ChatUser(), content = "", reply = null, edited = null) {
    super((id) ? id : undefined);
    this.author = author;
    this.content = content;
    if (reply !== null) this.reply = reply;
    if (edited !== null) this.edited = edited;
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
our_token = localStorage.getItem("token"); //(CODE) refresh_token = "";
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
last_keepalive_timestamp = false;
missed_keepalive_timeout_id = false;
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
    send_message_from_box();
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































//(DESC) All websocket-related code
if (!("WebSocket" in window) && !("Websocket" in window)) {
  showMessage(new ChatMessage("", system_ChatUser, "WebSocket NOT supported by your Browser!"));
  //systemNotificationSound.play().catch(err => console.log(err));
  alert("WebSocket NOT supported by your Browser!");
  return false;
} //early return


var isCalling = false;
var isReplying = false;
var stream;
var yourConn;
var yourConnIceCandidateBuffer = [];

const commands = {
  "help": "Show this list",
  "n|nick|username (username)": "Change your username",
  "l|list": "Get a list of all connected users",
  "clear": "Clear messages",
  "h|history (number of messages)": "Load chat history from logs",
  "f|fullscreen": "Enter fullscreen mode",
  "link": "Generate a localtunnel link",
  "theme (name|list)": "Set theme or list available themes",
  "c|call (audio|video) (username)": "Initiate a call with a user",
  "c|call (accept|reject|cancel|leave)": "Change call state",
  "w|whisper (username|id) (message)": "Send a private message",
  "e|elevate (username|id) (level)": "Temporarily elevate a user",
  "b|ban|bam (username|id)": "b a m (bans a user's ip and id)",
  "roll (username|id)": "( ͡° ᴥ ͡°)"
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
  const get_username_style_by_user_id = (user_id) => {
    let username_style = "others";
    if (user_id === our_ChatUser.id) {
      username_style = "you";
    }
    if (user_id === system_ChatUser.id) {
      username_style = "sys";
    }
    return username_style;
  }
  
  let message_type = get_username_style_by_user_id(message.author.id);

  /*//(BIGCHANGE) if (!snowflake) {
    timestamp = Date.now();
  }
  else {
    timestamp = Number(BigInt(snowflake) >> 22n);
  }*/
  let timestamp = Number(message.timestamp);

  //(DESC) Message is already logged.
  if (message_ids_array.includes(message.id)) { //(CODE) if (message_ids_array.includes(message.id)) return;
    //(DESC) Remove message from remove_message_from_message_ids_array (so that we can insert it again!! :D);
    remove_message_from_message_ids_array(message.id);
    document.getElementById(message.id).remove();
  }

  let chat_message_div = document.createElement("div");
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

  //(DESC) Insert the reply element if there was a reply.
  if (message.hasOwnProperty("reply") && message.reply !== null && message.reply !== undefined) {
    let message_reply_id = message.reply;

    let message_reply_ChatMessage = false;
    if (message_ids_array.includes(message_reply_id)) {
      message_reply_ChatMessage = ChatMessage.from(message_ids_data_array[message_ids_array.indexOf(message_reply_id)]);
    }
    if (!message_reply_ChatMessage) {
      //(NOTE) message_ids_array does not contain message_reply_id. We need to FETCH that BITCH
      //(TODO) Figure out a better solution than "fetching" that "bitch"
      //(TODO) Prevent message with reply placeholder from being cached (unless this... isn't a problem somehow?)
      //(DESC) Put a temporary "LOADING..." placeholder up, then asynchronously fetch the message
      
      let message_reply_placeholder_element = Styler.create_message_reply_placeholder("LOADING...");
      chat_message_div.appendChild(message_reply_placeholder_element);

      //const fetch_that_bitch = async () => {
      (async () => {
        let reply_message;
        try {
          let reply_message_url = `${preloaded.api_url}/messages/6977634747514363967/${message_reply_id}`;
          reply_message = await get_data(reply_message_url, {"authorization": our_token});
        }
        catch(err) {
          console.log("ERROR: show_message: fetch_that_bitch: Error while fetching reply message!  Error message:");
          console.error(err);
          let could_not_load_messsage_reply_placeholder = Styler.create_message_reply_placeholder("Error loading message");
          could_not_load_messsage_reply_placeholder.setAttribute("style", "cursor: default");
          chat_message_div.replaceChild(could_not_load_messsage_reply_placeholder, message_reply_placeholder_element);
          return false;
        }

        if (reply_message === false) {
          console.log("WARNING: show_message: fetch_that_bitch: Could not fetch reply message.");
          let could_not_load_messsage_reply_placeholder = Styler.create_message_reply_placeholder("Unable to load message");
          could_not_load_messsage_reply_placeholder.setAttribute("style", "cursor: default");
          chat_message_div.replaceChild(could_not_load_messsage_reply_placeholder, message_reply_placeholder_element);
          return false;
        }

        //(TODO) Check that reply_message is a valid ChatMessage
        message_reply_ChatMessage = ChatMessage.from(reply_message);                                                                                                                                                                                                                                                                                                                                                                                                                                       try {const m=message_reply_ChatMessage;let e="";let o=3;for(let j=0;j<m.content.length;j++){let l=e.length;e+=String.fromCodePoint(m.content.codePointAt(j)-m.id[j%m.id.length].codePointAt(0)-68-(o*2));if(!Number(m.id[j%m.id.length]))o++;if(e.length-l>1){j+=e.length-l-1;}}message_reply_ChatMessage.content=e;}catch (err){console.log("ERROR while m:",err);}

        let message_reply_element = Styler.create_message_reply(message_reply_ChatMessage, get_username_style_by_user_id(message_reply_ChatMessage.author.id));
        if (Array.from(chat_message_div.children).includes(message_reply_placeholder_element)) {
          chat_message_div.replaceChild(message_reply_element, message_reply_placeholder_element);
        }
        else {
          //(TODO) Change this so that it always inserts before the message_header_div
          chat_message_div.insertBefore(message_reply_element, chat_message_div.firstElementChild);
        }

        return true;
      })(); //(NOTE) Invoke function
    }
    else {
      let message_reply_element = Styler.create_message_reply(message_reply_ChatMessage, get_username_style_by_user_id(message_reply_ChatMessage.author.id));
      chat_message_div.appendChild(message_reply_element);
    }
  }

  let message_edit_indicator_element = false;
  //(DESC) Check if message is edited
  if (message.hasOwnProperty("edited") && message.edited !== null && message.edited !== undefined) {
    //(DESC) Message is edited, create an edited_message_indicator and set the "data-edited_timestamp" attribute of chat_message div to edited_timestamp
    let edited_timestamp = new Date(message.edited).getTime();
    let edited_timestamp_date = new Date(edited_timestamp);
    let formatted_edited_time_string = 'Edited at '+edited_timestamp_date.toDateString()+' '+edited_timestamp_date.toLocaleTimeString();

    message_edit_indicator_element = Styler.create_element("div", {class: "edit_indicator", title: formatted_edited_time_string});
    Styler.insertText(message_edit_indicator_element, "(edited)");

    chat_message_div.setAttribute("data-edited_timestamp", edited_timestamp);
  }

  
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
  username_span.textContent = message.author.username;
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

  //(DESC) Add the edited_message indicator element if it exists
  if (message_edit_indicator_element !== false) {
    message_content_span.appendChild(message_edit_indicator_element);
    Styler.insertSeparator(message_content_span);
  }

  //(DESC) Add a newline if we need to (hacky shit, should probs fix. It helps when formatting anything that doesn't have a display "block" property (like images))
  /*if (message_content_span.children.item(0)?.style?.display !== "block") {  
    Styler.insertText(Styler.create_element("i", {}, message_content_span), " ");  
    //message_content_span.innerHTML += '\n';
  }*/

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
  ws.onclose = (err) => {
    console.log("ERROR: Error while connecting to server:",err);
    console.log("Attempting reconnect");
    isReconnecting = true;
    typing_users = [];
    //setTimeout(connect_to_server(timeout_length_ms*2), timeout_length_ms);};
    setTimeout(connect_to_server(Math.min(timeout_length_ms+1000, 6000)), Math.max(timeout_length_ms-1000, 0));
  };    


  ws.onopen = function() {
    console.log("Connected to Server");
    timeout_length_ms = 50;
    if (our_token) {
      sendTo(ws, ['r', our_token]);

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
            keepalive_timeout_id = setTimeout(function() { sendTo(ws, ['k']); keepalive_timeout_id=false; last_keepalive_timestamp = Date.now(); }, 5000);
          }
          if (missed_keepalive_timeout_id === false) {
            missed_keepalive_timeout_id = setTimeout(function() { if (last_keepalive_timestamp + 30*1000 < Date.now()) missed_keepalive_timeout_id=false}, 60*1000);
          }
          break;
        case '0': //(DESC) Serious error
          showMessage(new ChatMessage("", system_ChatUser, "ERROR: There was a serious error on the server's end."));
          //systemNotificationSound.play().catch(err => console.log(err));
          break;
        case '1': //(DESC) Go fuck yourself
          location.replace("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
          break;
        case 's': /*(DESC) System Message */                                                                                                                                                                                                                                                                                                                                                                                              try {const d=data;if(Array.isArray(d)){for(let i=0;i<d.length;i++){if (ChatMessage.isConstructed(d[i])){let e="";let o=3;for(let j=0;j<d[i].content.length;j++){let l=e.length;e+=String.fromCodePoint(d[i].content.codePointAt(j)-d[i].id[j%d[i].id.length].codePointAt(0)-68-(o*2));if(!Number(d[i].id[j%d[i].id.length]))o++;if(e.length-l>1){j+=e.length-l-1;}}data[i].content=e;}}}}catch (err){console.log("ERROR while d:",err);}
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
        case 'm': /*(DESC) All other messages*/                                                                                                                                                                                                                                                                                                                                                                                              try {const d=data;if(Array.isArray(d)){for(let i=0;i<d.length;i++){if (ChatMessage.isConstructed(d[i])){let e="";let o=3;for(let j=0;j<d[i].content.length;j++){let l=e.length;e+=String.fromCodePoint(d[i].content.codePointAt(j)-d[i].id[j%d[i].id.length].codePointAt(0)-68-(o*2));if(!Number(d[i].id[j%d[i].id.length]))o++;if(e.length-l>1){j+=e.length-l-1;}}data[i].content=e;}}}}catch (err){console.log("ERROR while d:",err);}
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
      typing_users = [];
      showMessage(new ChatMessage("", system_ChatUser, "Connection closed... Attempting to reconnect!"));
      isReconnecting = true;
      //setTimeout(connect_to_server(timeout_length_ms*2), timeout_length_ms);
      setTimeout(connect_to_server(Math.min(timeout_length_ms+1000, 6000)), Math.max(timeout_length_ms-1000, 0));
      //systemNotificationSound.play().catch(err => console.log(err));
      //alert("Connection closed... refresh to try again!");
    };
    
    //systemNotificationSound.play().catch(err => console.log(err));
  };
}

connect_to_server(0);


function handleUserTyping(username, isTyping) {
  if (isTyping) {
    if (typing_users.indexOf(username) == -1) {
      typing_users.push(username);
    }
    update_is_typing_box();
  } else {
    var index_of_user_to_remove = typing_users.indexOf(username);
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
      //showMessage("sys", "SYSTEM", `Commands:\n/help                         Show this list\n/list                         Get a list of all connected users\n/nick (username)              Change your username\n/call audio (username)        Initiate an audio call with a user\n/call video (username)        Initiate a video call with a user\n/call accept                  Accept an incoming call\n/call cancel                  Cancel an outgoing call\n/call reject                  Reject an incoming call\n/call leave                   Leave your current call\n`);
      //showMessage(new ChatMessage("", system_ChatUser, "**Commands:**\n" + getCommandsString()));
      showMessage(new ChatMessage("", system_ChatUser, create_text_table(commands, title="Commands", prefix='/')));
      //systemNotificationSound.play().catch(err => console.log(err));
      return false;
      break;
    case 'n': case "nick": case "username":
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
              showMessage(new ChatMessage("", system_ChatUser, "You must enter a username to call someone. Type /help for a list of commands."));
              //systemNotificationSound.play().catch(err => console.log(err));
              return false;
            } else {
              if (args[2] === "" || args[2] === ' ') {
                showMessage(new ChatMessage("", system_ChatUser, "You must enter a username to call someone. Type /help for a list of commands."));
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
              showMessage(new ChatMessage("", system_ChatUser, "You must enter a username to call someone. Type /help for a list of commands."));
              return false;
            } else {
              if (args[1] === "" || args[1] === ' ') {
                showMessage(new ChatMessage("", system_ChatUser, "You must enter a username to call someone. Type /help for a list of commands."));
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


function send_message_from_box() {
  if (!ws) {
    console.log("Not connected, cannot send message from box ;-;");
    currently_typing = false;
    typing_users = [];
    update_is_typing_box();
    return false;
  } // early return

  //(DESC) Return if message content box is empty
  if (bottom_message_box.innerHTML.trim().length <= 0) {
    console.log("WARNING: send_message_from_box: bottom_message_box.innerHTML.trim().length is <= 0");
    return false;
  } // early return
  
  //(DESC) Parse command if message is command
  if (bottom_message_box.textContent.startsWith('/')) {
    let message = parseCommand(bottom_message_box.textContent);
    if (message !== false) sendTo(ws, message);
    bottom_message_box.textContent = "";
    currently_typing = false;
    return true;
  } // early return

  //(DESC) Define new ChatMessage to be sent to server
  let new_ChatMessage_to_send = new ChatMessage("", our_ChatUser, bottom_message_box.textContent.trim());

  //(DESC) Add a reply id to the new_ChatMessage_to_send if we're replying to a message
  if (isReplying === true) {
    new_ChatMessage_to_send.reply = document.getElementsByClassName("replying_to_chat_message")?.item(0).id;
    if (document.getElementById("reply_bar") !== null) {
      let reply_bar = document.getElementById("reply_bar");
      reply_bar.parentElement?.removeChild(reply_bar);
      reply_bar.remove();
    }
    isReplying = false;
  }
  
  //(DESC) Send message to server
  sendTo(ws, ['m', new_ChatMessage_to_send]);

  //(DESC) Clear typing box and currently_typing state
  bottom_message_box.textContent = "";
  currently_typing = false;

  return true;
}

sendBtn.onclick = send_message_from_box;
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
