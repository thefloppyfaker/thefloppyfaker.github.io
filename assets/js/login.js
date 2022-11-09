//(DESC) Returns an object 
// login_page = {
//   login_page_element: HTMLElement, 
//   login_page_input_elements: {
//     input_fields: HTMLElement[],
//     forgot_password_button: HTMLElement,
//     confirm_button: HTMLElement,
//     cancel_button: HTMLElement
//   }
// }
function generate_login_page(header_text="", input_rows_array=[{label: "", datatype: ""}], forgot_password_button_text="", confirm_button_text="", cancel_button_text="") {
  //function create_element(tagname, parent_element=null, id="", className="") {
  function create_element(tagname, attributes={}, parent_element=null) {
    let new_element = document.createElement(tagname);
    Object.entries(attributes).forEach(([attribute_name, attribute_value]) => {
      new_element.setAttribute(attribute_name, attribute_value);
    });
    if (parent_element) parent_element.appendChild(new_element);
    return new_element;
  }

  let login_page_container = create_element("div", {class: "login_page_container"});
  let login_form_wrapper = create_element("div", {class: "login_form_wrapper"}, login_page_container);
  let login_form = create_element("div", {class: "login_form"}, login_form_wrapper);

  let login_form_header;
  if (header_text) {
    login_form_header = create_element("span", {class: "login_form_header"}, login_form);
    login_form_header.innerText = header_text;
  }

  let login_form_input_fields = [];
  if (input_rows_array) {
    if (input_rows_array.length > 0) {
      let login_form_input_container = create_element("div", {class: "login_form_input_container"}, login_form);
      let login_form_input_content = create_element("div", {class: "login_form_input_content"}, login_form_input_container);
      input_rows_array.forEach(({label, datatype}) => {
        let new_login_form_input_content_row = create_element("div", {class: "login_form_input_content_row"}, login_form_input_content);
        let new_login_form_input_field = create_element("input", {class: "login_form_input_field", type: "text", required: "required", "data-type": datatype}, new_login_form_input_content_row);
        let login_form_input_field_label = create_element("label", {class: "login_form_input_field_label"}, new_login_form_input_content_row);
        login_form_input_field_label.innerText = label;
        new_login_form_input_field.addEventListener("input", (ev) => {
          let this_element = ev.target;
          if (ev.srcElement) {
            this_element = ev.srcElement;
          }
          if (this_element.value === "") {
            if (this_element.hasAttribute("data-valid")) {
              this_element.removeAttribute("data-valid");
            }
            if (this_element.hasAttribute("data-invalid")) {
              this_element.removeAttribute("data-invalid");
            }
          }
          else if (is_valid_input_data(this_element.value, this_element.getAttribute("data-type"))) {
            this_element.setAttribute("data-valid", "data-valid");
            if (this_element.hasAttribute("data-invalid")) {
              this_element.removeAttribute("data-invalid");
            }
          }
          else {
            this_element.setAttribute("data-invalid", "data-invalid");
            if (this_element.hasAttribute("data-valid")) {
              this_element.removeAttribute("data-valid");
            }
          }
          if (confirm_button_text) {
            if (login_form_input_fields.every(element => element.hasAttribute("data-valid"))) {
              if (login_form_confirm_button.hasAttribute("disabled")) {
                login_form_confirm_button.removeAttribute("disabled");
              }
            }
            else {
              if (!login_form_confirm_button.hasAttribute("disabled")) {
                login_form_confirm_button.setAttribute("disabled", "disabled");
              }
            }
          }
        });
        
        login_form_input_fields.push(new_login_form_input_field);
      });
    }
  }

  let login_form_forgot_password_button = undefined;
  if (forgot_password_button_text) {
    let login_form_forgot_password = create_element("div", {class: "login_form_forgot_password"}, login_form);
    login_form_forgot_password_button = create_element("div", {class: "login_form_forgot_password_button"}, login_form_forgot_password);
    login_form_forgot_password_button.innerText = forgot_password_button_text;
  }
  
  let confirm_and_cancel_buttons_container;
  if (confirm_button_text || cancel_button_text) {
    confirm_and_cancel_buttons_container = create_element("div", {class: "confirm_and_cancel_buttons_container"}, login_form);
  }
  let login_form_confirm_button = undefined;
  if (confirm_button_text) {
    login_form_confirm_button = create_element("div", {class: "login_form_confirm_button", disabled: "disabled"}, confirm_and_cancel_buttons_container);
    login_form_confirm_button.innerText = confirm_button_text;
  }
  let login_form_cancel_button = undefined;
  if (cancel_button_text) {
    login_form_cancel_button = create_element("div", {class: "login_form_cancel_button"}, confirm_and_cancel_buttons_container);
    login_form_cancel_button.innerText = cancel_button_text;
  }
  
  let login_page = {
    login_page_element: login_page_container, 
    login_page_input_elements: {
      input_fields: login_form_input_fields,
      forgot_password_button: login_form_forgot_password_button,
      confirm_button: login_form_confirm_button,
      cancel_button: login_form_cancel_button
    }
  }
  
  return login_page;
}

//forgor_btn.addEventListener('click', (ev) => {window.location.assign("file:///C:/Users/thefl/Documents/node_stuff/login_page_testing/forgor.html");})
//cancel_btn.addEventListener('click', (ev) => {window.location.assign("file:///C:/Users/thefl/Documents/node_stuff/login_page_testing/signup.html");})

//(DESC) Check if input data is valid, returns true if valid and false if invalid.
const is_valid_input_data = (value, datatype) => {
  if (datatype === "email") {
    let isValidEmailRegexExp = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/gi;
    return isValidEmailRegexExp.test(value);
  }
  else if (datatype === "password") {
    let min_password_length = 6;
    let max_password_length = 512;
    if (value.length >= min_password_length && value.length <= max_password_length) {
      return true;
    }
    return false;
  }
  else if (datatype === "username") {
    let min_username_length = 2;
    let max_username_length = 64;
    let banned_usernames = ["system", "you", "discord"];
    new_username = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E\x80-\xFE]+/gi, "").trim(); //(NOTE) ASCII Characters 0x20 through 0x7E and 0x80 through 0xFE (all printable characters except for nbsp) 
    username_to_check = new_username.replace(/[^\x21-\x7E\x80-\xFE]+/gi, "").toLowerCase();
    if (username_to_check.length > 0 && !banned_usernames.includes(username_to_check)) {
      if (new_username.length <= max_username_length && new_username.length >= min_username_length) {
        return true;
      }
    }
    return false;
  }
  else {
    console.log("ERROR: Invalid datatype given to is_valid_input_data!!! datatype=",datatype);
    return false;
  }
}


//(DESC) Switches page to a different login type. Returns the new login page element
//(ARGS) login_page_element: HTMLElement, 
//       login_step: "login" | "signup" | "forgor" 
function change_login_step(login_page_element, login_step="") {
  let login_page;  

  if (login_step === "login") {
    login_page = generate_login_page("Log in", [{label: "Email", datatype: "email"}, {label: "Password", datatype: "password"}], "I forgor 💀", "Log in", "Sign up");
    email_input_element = login_page.login_page_input_elements.input_fields[0];
    password_input_element = login_page.login_page_input_elements.input_fields[1];

    login_page.login_page_input_elements.confirm_button.addEventListener('click', (ev) => {
      let this_element = ev.target;
      if (ev.srcElement) {
        this_element = ev.srcElement;
      }
      if (this_element.hasAttribute("disabled")) return;

      submit_form("login", {email: email_input_element.value, password: password_input_element.value});
    });

    login_page.login_page_input_elements.cancel_button.addEventListener('click', () => {change_login_step(login_page.login_page_element, "signup")});
    login_page.login_page_input_elements.forgot_password_button.addEventListener('click', () => {change_login_step(login_page.login_page_element, "forgor")});
  }
  else if (login_step === "signup") {
    login_page = generate_login_page("Sign up", [{label: "Username", datatype: "username"}, {label: "Email", datatype: "email"}, {label: "Password", datatype: "password"}], null, "Continue", "Log in");
    username_input_element = login_page.login_page_input_elements.input_fields[0];
    email_input_element = login_page.login_page_input_elements.input_fields[1];
    password_input_element = login_page.login_page_input_elements.input_fields[2];

    login_page.login_page_input_elements.confirm_button.addEventListener('click', (ev) => {
      let this_element = ev.target;
      if (ev.srcElement) {
        this_element = ev.srcElement;
      }
      if (this_element.hasAttribute("disabled")) return;

      submit_form("signup", {username: username_input_element.value, email: email_input_element.value, password: password_input_element.value});
    });

    login_page.login_page_input_elements.cancel_button.addEventListener('click', () => {change_login_step(login_page.login_page_element, "login")});
  }
  else if (login_step === "forgor") {
    login_page = generate_login_page("Reset password", [{label: "Email", datatype: "email"}], "I forgor 💀", "Continue", "I rember 😃");
    email_input_element = login_page.login_page_input_elements.input_fields[0];

    login_page.login_page_input_elements.confirm_button.addEventListener('click', (ev) => {
      let this_element = ev.target;
      if (ev.srcElement) {
        this_element = ev.srcElement;
      }
      if (this_element.hasAttribute("disabled")) return;

      submit_form("forgor", {email: email_input_element.value});
    });

    login_page.login_page_input_elements.forgot_password_button.addEventListener('click', () => {change_login_step(login_page.login_page_element, "signup")});
    login_page.login_page_input_elements.cancel_button.addEventListener('click', () => {change_login_step(login_page.login_page_element, "login")});
  }
  else {
    console.log(`ERROR: ${login_step} is not a valid value for login_step!!!`);
    return false;
  }


  if (login_page_element) {
    login_page_element.remove();
  }
  
  return document.body.appendChild(login_page.login_page_element);
}

change_login_step(null, "login");












//(DESC) Submits a form to the server based on login type.
//(ARGS) login_step: "login" | "signup" | "forgor",
//       data: {data-type: value, data-type: value, etc.}
function submit_form(login_step, data) {
  if (login_step === "login") {
    //(DESC) User is logging in. Object.keys(data) = ["email", "password"]
    alert(`Log in\ndata: ${JSON.stringify(data)}`);
  }
  else if (login_step === "signup") {
    //(DESC) User is signing up. Object.keys(data) = ["username", "email", "password"]
    alert(`Sign up\ndata: ${JSON.stringify(data)}`);
  }
  else if (login_step === "forgor") {
    //(DESC) User forgor their password. Object.keys(data) = ["email"]
    alert(`Forgot password\ndata: ${JSON.stringify(data)}`);
  }
  else {
    console.log("ERROR: Invalid login_step in sumbin_form function!!! login_step=",login_step);
  }
}