(()=>{
'use strict';
const card=document.querySelector('#loginScreen .login-card');if(!card)return;
const button=document.createElement('button');button.type='button';button.className='vccf-guest-return';button.textContent='Create an account · Request approval';card.append(button);
button.onclick=()=>{
 if(document.getElementById('registrationForm'))return;
 const form=document.createElement('form');form.id='registrationForm';form.innerHTML='<h2>Register for VCCF Connect</h2><p>Your request needs admin approval. After approval, check your email for an invitation to set your password.</p><div class="field"><label for="regName">Full name</label><input id="regName" name="display_name" required maxlength="120" autocomplete="name"></div><div class="field"><label for="regEmail">Email address</label><input id="regEmail" name="email" type="email" required maxlength="254" autocomplete="email"></div><div class="field"><label for="regContact">Contact number (optional)</label><input id="regContact" name="contact" type="tel" maxlength="40" autocomplete="tel"></div><div class="field"><label for="regNotes">Area / ministry (optional)</label><input id="regNotes" name="notes" maxlength="500"></div><button class="btn" type="submit">Submit registration</button> <button class="btn secondary" type="button" id="cancelRegistration">Cancel</button><p role="status" id="regMsg"></p>';
 card.append(form);button.hidden=true;document.getElementById('loginForm').hidden=true;
 form.querySelector('#cancelRegistration').onclick=()=>{form.remove();button.hidden=false;document.getElementById('loginForm').hidden=false;button.focus();};
 form.onsubmit=async e=>{e.preventDefault();const submit=form.querySelector('[type=submit]'),msg=form.querySelector('#regMsg');submit.disabled=true;msg.textContent='Submitting…';try{const values=Object.fromEntries(new FormData(form));const {error}=await window.VCCF.sb.rpc('submit_account_registration',{p_name:values.display_name,p_email:values.email,p_contact:values.contact,p_notes:values.notes});if(error)throw error;form.reset();msg.textContent='Registration received. Please wait for admin approval. If approved, you will receive an email invitation to set your password.';}catch(error){msg.textContent=error.message||'Unable to submit registration. Please try again.';}finally{submit.disabled=false;}};
 form.querySelector('input').focus();
};
})();
