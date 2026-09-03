import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:corsHeaders});
const normalizeUsername=(value:string)=>value.trim().toLowerCase().replace(/[^a-z0-9._-]/g,"").replace(/^[-_.]+|[-_.]+$/g,"");

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return json({error:"Method not allowed."},405);
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"").trim();
  if(!token)return json({error:"Missing authorization."},401);
  const url=Deno.env.get("SUPABASE_URL");
  const secretKeys=Deno.env.get("SUPABASE_SECRET_KEYS");
  const secretKey=secretKeys?JSON.parse(secretKeys).default:Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const publishableKeys=Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  const publishableKey=publishableKeys?JSON.parse(publishableKeys).default:Deno.env.get("SUPABASE_ANON_KEY");
  if(!url||!secretKey||!publishableKey)return json({error:"Supabase server configuration is missing."},500);
  const adminClient=createClient(url,secretKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const userClient=createClient(url,publishableKey,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false},global:{headers:{Authorization:`Bearer ${token}`}}});
  const {data:authData,error:authError}=await userClient.auth.getUser(token);
  if(authError||!authData.user)return json({error:"Unauthorized."},401);
  const {data:caller,error:callerError}=await adminClient.from("profiles").select("user_id,role").eq("user_id",authData.user.id).maybeSingle();
  if(callerError)return json({error:callerError.message},500);
  if(caller?.role!=="admin")return json({error:"Only administrators can create accounts."},403);
  try{
    const body=await req.json(),mode=String(body?.account_mode||"email_invite").trim().toLowerCase(),displayName=String(body?.display_name||"").trim(),role=String(body?.role||"member").trim().toLowerCase(),memberId=body?.member_id||null;
    let areaId=body?.area_id||null;
    const allowedRoles=["admin","pastor","treasurer","area_leader","member"];
    if(!["email_invite","username_temp"].includes(mode))return json({error:"Invalid account creation mode."},400);
    if(!displayName)return json({error:"Display name is required."},400);
    if(!allowedRoles.includes(role))return json({error:"Invalid account role."},400);
    if(role==="area_leader"&&!areaId)return json({error:"Area Leader accounts require an assigned area."},400);
    if(["member","treasurer"].includes(role)&&!memberId)return json({error:"Member and Treasurer accounts must be linked to a member record."},400);
    if(["admin","pastor","treasurer"].includes(role))areaId=null;
    if(memberId){
      const {data:member,error:memberError}=await adminClient.from("members").select("id,display_name,member_code,area_id,is_active,status").eq("id",memberId).maybeSingle();
      if(memberError)return json({error:memberError.message},500);
      if(!member)return json({error:"Selected member record was not found."},400);
      if(member.is_active===false||String(member.status||"").toLowerCase()==="inactive")return json({error:"Selected member is inactive. Activate the member before creating an account."},400);
      if(role==="area_leader"&&member.area_id&&String(member.area_id)!==String(areaId))return json({error:"The linked member must belong to the Area Leader's assigned area."},400);
      const {data:linked,error:linkedError}=await adminClient.from("profiles").select("user_id,display_name").eq("member_id",memberId).maybeSingle();
      if(linkedError)return json({error:linkedError.message},500);
      if(linked)return json({error:`That member is already linked to ${linked.display_name||"another account"}.`},400);
    }
    let createdUser:any=null,identifier="",mustChangePassword=false;
    if(mode==="email_invite"){
      const email=String(body?.email||"").trim().toLowerCase();
      if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json({error:"Enter a valid e-mail address."},400);
      const {data:invited,error:inviteError}=await adminClient.auth.admin.inviteUserByEmail(email,{redirectTo:"https://vccfsm-attendance.vercel.app/",data:{display_name:displayName}});
      if(inviteError||!invited.user)return json({error:inviteError?.message||"Unable to send the account invitation."},400);
      createdUser=invited.user;identifier=email;
    }else{
      const username=normalizeUsername(String(body?.username||"")),password=String(body?.temporary_password||"");
      if(username.length<2)return json({error:"Username must contain at least 2 letters or numbers."},400);
      if(password.length<8)return json({error:"Temporary password must be at least 8 characters."},400);
      const emailAlias=`${username}@vccf.local`;
      const {data:created,error:createError}=await adminClient.auth.admin.createUser({email:emailAlias,password,email_confirm:true,user_metadata:{display_name:displayName,username}});
      if(createError||!created.user)return json({error:createError?.message||"Unable to create the username account."},400);
      createdUser=created.user;identifier=username;mustChangePassword=true;
    }
    const {error:profileError}=await adminClient.from("profiles").upsert({user_id:createdUser.id,role,area_id:areaId,member_id:memberId,display_name:displayName,must_change_password:mustChangePassword,updated_at:new Date().toISOString()},{onConflict:"user_id"});
    if(profileError){await adminClient.auth.admin.deleteUser(createdUser.id);return json({error:profileError.message},400)}
    await adminClient.from("audit_log").insert({actor_user_id:authData.user.id,action:mode==="email_invite"?"create_account_invite":"create_username_account",entity_type:"profile",entity_id:createdUser.id,metadata:{identifier,mode,role,area_id:areaId,member_id:memberId}});
    return json({ok:true,mode,user_id:createdUser.id,identifier,role,must_change_password:mustChangePassword});
  }catch(error){return json({error:error instanceof Error?error.message:"Unable to create account."},400)}
});
