import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const API = (process.env.EXPO_PUBLIC_API_URL || 'https://backend-ascend.onrender.com/api').replace(/\/+$/, '');
const TOKEN_KEY = 'ascend_mobile_token';
const C = { bg:'#090e19', panel:'#111c31', card:'#17253d', border:'#293d58', text:'#eef5ff', muted:'#9cacca', blue:'#65cafa', aqua:'#59ebc6', gold:'#ffd27a', red:'#ff939c' };
const menus = [ ['status','Início','⌂'],['missions','Missões','✓'],['shop','Loja','◆'],['routine','Rotina','▤'],['ai','IA','✦'] ];
const FAQ = [
  ['Como ganho moedas?', 'Conclua missões e receba as recompensas indicadas.'],
  ['As compras são salvas?', 'Sim. A loja registra cada compra no servidor e sincroniza saldo e histórico em todos os aparelhos.'],
  ['A IA funciona sem pagar?', 'Seu administrador pode ativar a IA com uma cota gratuita (provedor Groq). Sem chave, o sistema responde em modo local.'],
  ['E os itens do inventário?', 'No app mobile é possível acompanhar suas compras. A ativação de temporizadores permanece disponível na versão web.'],
  ['Minha conta funciona no site?', 'Sim. O aplicativo usa o mesmo login e banco de dados do ASCEND web.']
];

async function request(path, { token, method='GET', body } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 16000);
  try {
    const response = await fetch(API + path, {
      method, headers: {'Content-Type':'application/json', ...(token ? {Authorization:'Bearer '+token} : {})},
      ...(body === undefined ? {} : {body: JSON.stringify(body)}), signal: controller.signal
    });
    let json = null;
    try {json = await response.json();} catch (_) {}
    if (!response.ok) {
      const error = new Error(json?.message || `Erro de conexão (${response.status}).`);
      error.status=response.status;
      throw error;
    }
    return json;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Tempo de resposta esgotado. Confira sua conexão.');
    throw error;
  } finally { clearTimeout(timeout); }
}

function Panel({ children, style }) {return <View style={[styles.panel,style]}>{children}</View>}
function Label({children,accent=false}) {return <Text style={[styles.eyebrow,accent && {color:C.aqua}]}>{children}</Text>}
function Action({title,onPress,secondary=false,disabled=false,small=false}) {
  return <Pressable disabled={disabled} onPress={onPress} accessibilityRole="button" style={({pressed})=>[styles.action, secondary&&styles.actionSecondary, small&&styles.actionSmall, disabled&&{opacity:.45}, pressed&&{opacity:.78}]}><Text style={[styles.actionText,secondary&&{color:C.text}]}>{title}</Text></Pressable>;
}
function Field({label,value,onChangeText,placeholder,secureTextEntry=false,multiline=false,keyboardType='default'}) {
  return <View style={{marginBottom:14}}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#697d9d" secureTextEntry={secureTextEntry} keyboardType={keyboardType} autoCapitalize={keyboardType==='email-address'?'none':'sentences'} multiline={multiline} style={[styles.input,multiline&&{height:95,textAlignVertical:'top'}]} /></View>
}
function Empty({text}) {return <Text style={styles.empty}>{text}</Text>}
const coinsText = n => (Number(n)||0).toLocaleString('pt-BR');

export default function App(){
  const [token,setToken]=useState(null);
  const [authReady,setAuthReady]=useState(false);
  const [register,setRegister]=useState(false);
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [name,setName]=useState('');
  const [authBusy,setAuthBusy]=useState(false);
  const [busy,setBusy]=useState(false);
  const [tab,setTab]=useState('status');
  const [status,setStatus]=useState(null);
  const [shop,setShop]=useState({coins:0,purchases:[]});
  const [plan,setPlan]=useState(null);
  const [refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState('');
  const [help,setHelp]=useState(false);
  const [expanded,setExpanded]=useState(-1);
  const [goals,setGoals]=useState('');
  const [routine,setRoutine]=useState('');
  const [minutes,setMinutes]=useState('60');
  const [draft,setDraft]=useState('');
  const [conversation,setConversation]=useState([]);
  const [chatBusy,setChatBusy]=useState(false);
  const [aiConsent,setAiConsent]=useState(false);
  const profile=useMemo(()=>({primaryGoals:goals,routineSummary:routine,availableMinutesPerDay:Math.min(720,Math.max(10,Number(minutes)||60)),workoutDays:['segunda','quarta','sexta']}),[goals,routine,minutes]);

  const logout=useCallback(async()=>{
    if(token){try{await request('/auth/logout',{token,method:'POST'});}catch(_) {}}
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);setStatus(null);setShop({coins:0,purchases:[]});setConversation([]);setPlan(null);setTab('status');setHelp(false);setError('');
  },[token]);

  const fetchState=useCallback(async(t=token,quiet=false)=>{
    if(!t)return;
    if(!quiet)setBusy(true);
    try{
      const [current, purchases]=await Promise.all([request('/player/status',{token:t}),request('/shop',{token:t})]);
      setStatus(current);setShop(purchases);setError('');
    }catch(e){
      if(e.status===401){await SecureStore.deleteItemAsync(TOKEN_KEY);setToken(null);setStatus(null);}
      setError(e.message);
    }finally{setBusy(false);}
  },[token]);

  useEffect(()=>{SecureStore.getItemAsync(TOKEN_KEY).then(t=>{if(t)setToken(t);}).finally(()=>setAuthReady(true));},[]);
  useEffect(()=>{if(token)fetchState(token);},[token,fetchState]);

  async function login(){
    if(!email.trim()||!password){setError('Informe e-mail e senha.');return;}
    setAuthBusy(true);setError('');
    try{
      const data=await request(register?'/auth/register':'/auth/login',{method:'POST',body:register?{name:name.trim(),email:email.trim(),password}:{email:email.trim(),password}});
      await SecureStore.setItemAsync(TOKEN_KEY,data.token);
      setToken(data.token);setPassword('');
    }catch(e){setError(e.message);}finally{setAuthBusy(false);}
  }
  async function runAction(path,body){
    setBusy(true);setError('');
    try{
      const result=await request(path,{token,method:'POST',body});
      await fetchState(token,true);
      return result;
    }catch(e){setError(e.message);Alert.alert('ASCEND',e.message);return null;}
    finally{setBusy(false);}
  }
  async function generatePlan(){const result=await runAction('/player/status/planner',profile);if(result)setPlan(result);}
  async function completeMission(mission){
    const endpoint=mission.cadence?'/player/status/planner/missions/'+encodeURIComponent(mission.id)+'/complete':'/player/status/missions/'+encodeURIComponent(mission.id)+'/complete';
    const result=await runAction(endpoint,mission.cadence?profile:undefined);
    if(result&&plan){const refreshed=await request('/player/status/planner',{token,method:'POST',body:profile}).catch(()=>null);if(refreshed)setPlan(refreshed);}
  }
  async function buy(item){
    Alert.alert('Confirmar resgate',`Resgatar ${item.name} por ${item.cost} moedas?`,[
      {text:'Cancelar',style:'cancel'},
      {text:'Resgatar',onPress:async()=>{
        const result=await runAction('/shop/purchase',{itemId:item.id});
        if(result){setShop(result);Alert.alert('Compra concluída',`${item.name} entrou no inventário.`);}
      }}
    ]);
  }
  async function sendMessage(){
    const message=draft.trim();if(!message||chatBusy)return;
    if(message.length>2000){setError('A mensagem pode ter até 2.000 caracteres.');return;}
    const history=conversation.slice(-10);
    setConversation(prev=>[...prev,{role:'user',content:message}]);setDraft('');setChatBusy(true);setError('');
    try{
      const response=await request('/ai/chat',{token,method:'POST',body:{message,conversation:history,profile,externalConsent:aiConsent}});
      setConversation(prev=>[...prev,{role:'assistant',content:response.reply||'Sem resposta disponível.'}]);
    }catch(e){setConversation(prev=>[...prev,{role:'assistant',content:'Não consegui responder agora. '+e.message}]);}
    finally{setChatBusy(false);}
  }

  if(!authReady)return <View style={styles.splash}><ActivityIndicator color={C.aqua}/><Text style={styles.logo}>ASCEND</Text></View>;
  if(!token)return <KeyboardAvoidingView style={styles.root} behavior={Platform.OS==='ios'?'padding':undefined}><ScrollView contentContainerStyle={styles.authWrap} keyboardShouldPersistTaps="handled"><Label>EVOLUÇÃO PESSOAL / MOBILE</Label><Text style={styles.brand}>ASCEND<Text style={{color:C.aqua}}> .</Text></Text><Text style={styles.authTitle}>Torne cada dia uma conquista.</Text><Text style={styles.subtitle}>Um sistema real de rotina, missões e recompensas.</Text><Panel style={{marginTop:25}}><Text style={styles.section}>{register?'Criar conta':'Bem-vindo de volta'}</Text>{register&&<Field label="Nome" value={name} onChangeText={setName} placeholder="Seu nome"/>}<Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="voce@email.com"/><Field label="Senha" value={password} onChangeText={setPassword} secureTextEntry placeholder="Mínimo 8 caracteres"/>{!!error&&<Text style={styles.error}>{error}</Text>}<Action disabled={authBusy} title={authBusy?'Conectando...':register?'Criar conta':'Entrar no ASCEND'} onPress={login}/><Pressable onPress={()=>{setRegister(!register);setError('');}} style={{paddingTop:18}}><Text style={styles.link}>{register?'Já tenho conta — entrar':'Não tem conta? Criar uma'}</Text></Pressable></Panel><Text style={styles.authNote}>Sua chave de IA nunca é armazenada neste aplicativo.</Text></ScrollView><StatusBar barStyle="light-content"/></KeyboardAvoidingView>;

  const completed=new Set(status?.completedMissionIds||[]);
  const purchasedToday=new Set((shop?.purchases||[]).filter(p=>p.day===new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())).map(p=>p.itemId));
  const shopCatalog=(shop?.offers||[]).map(p=>({ ...p, type:p.id==='reliquia-ascendente'?'LENDÁRIO':'RECOMPENSA',desc:'Resgate uma recompensa com as moedas conquistadas em suas missões.' }));
  return <View style={styles.root}><StatusBar barStyle="light-content"/><View style={styles.topbar}><View><Label>O SISTEMA ESTÁ ONLINE</Label><Text style={styles.headerTitle}>ASCEND <Text style={{color:C.aqua}}>✦</Text></Text></View><View style={{flexDirection:'row',alignItems:'center',gap:10}}><Pressable onPress={()=>setHelp(true)} accessibilityLabel="Central de dúvidas" style={styles.circle}><Text style={styles.circleText}>?</Text></Pressable><View style={styles.coinPill}><Text style={{color:C.gold,fontWeight:'800'}}>◆ {coinsText(shop?.coins ?? status?.coins)}</Text></View></View></View>
  <ScrollView keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.aqua} onRefresh={async()=>{setRefreshing(true);await fetchState(token,true);setRefreshing(false);}}/>} contentContainerStyle={styles.content}>
  {!!error&&<Pressable onPress={()=>setError('')}><Text style={styles.error}>{error} ×</Text></Pressable>}
  {busy&&<ActivityIndicator color={C.aqua} size="small" style={{marginVertical:7}}/>}
  {help? <><View style={styles.heading}><View><Label>SUPORTE / FAQ</Label><Text style={styles.section}>Central de dúvidas</Text></View><Action title="Fechar" small secondary onPress={()=>setHelp(false)}/></View>{FAQ.map(([q,a],i)=><Pressable key={q} onPress={()=>setExpanded(expanded===i?-1:i)}><Panel><View style={styles.split}><Text style={[styles.cardTitle,{flex:1}]}>{q}</Text><Text style={{color:C.aqua}}>{expanded===i?'−':'+'}</Text></View>{expanded===i&&<Text style={styles.body}>{a}</Text>}</Panel></Pressable>)}<Action title="Perguntar à IA" onPress={()=>{setHelp(false);setTab('ai');}}/></>:
  tab==='status'?<><Label>DASHBOARD / STATUS</Label><Text style={styles.hero}>Sua evolução começa agora.</Text><Text style={styles.subtitle}>Bem-vindo, {status?.name||'Hunter'}. Mantenha seu ritmo e avance de nível.</Text><Panel style={styles.heroCard}><Label accent>HUNTER {status?.rank||'E'}</Label><Text style={styles.rank}>LVL {status?.level||1}</Text><Text style={styles.body}>Experiência: {coinsText(status?.experience)} / {coinsText(status?.nextLevelExperience)}</Text><View style={styles.progress}><View style={[styles.progressFill,{width:`${Math.min(100,100*(status?.experience||0)/Math.max(status?.nextLevelExperience||1,1))}%`}]}/></View></Panel><View style={styles.stats}><Panel style={{flex:1}}><Label>MOEDAS</Label><Text style={styles.metric}>{coinsText(shop?.coins ?? status?.coins)}</Text></Panel><Panel style={{flex:1}}><Label>SEQUÊNCIA</Label><Text style={styles.metric}>{status?.streakDays||0} <Text style={styles.metricUnit}>dias</Text></Text></Panel></View><Panel><Label>PRÓXIMA AÇÃO</Label><Text style={styles.cardTitle}>Seu progresso depende da constância.</Text><Text style={styles.body}>Comece completando suas missões e organizando seu foco diário.</Text><Action title="Ver minhas missões →" onPress={()=>setTab('missions')}/></Panel><Action title="Configurar rotina" secondary onPress={()=>setTab('routine')}/><Pressable onPress={()=>Alert.alert('Sair da conta','Deseja encerrar sua sessão?',[{text:'Cancelar',style:'cancel'},{text:'Sair',onPress:logout}])} style={{alignItems:'center',paddingVertical:14}}><Text style={{color:C.muted,fontSize:13}}>Encerrar sessão</Text></Pressable></>:
  tab==='missions'?<><Label>SISTEMA / QUESTS</Label><Text style={styles.section}>Missões do dia</Text><Text style={styles.subtitle}>Complete objetivos para ganhar EXP e moedas.</Text>{(status?.dailyMissions||[]).length?status.dailyMissions.map(m=><Panel key={m.id}><Label>{m.type||'QUEST'} · {m.required?'ESSENCIAL':'OPCIONAL'}</Label><Text style={styles.cardTitle}>{m.title}</Text><Text style={styles.body}>{m.description}</Text><Text style={styles.reward}>+{m.experienceReward} EXP · +{m.coinReward} moedas</Text><Action title={completed.has(m.id)?'Concluída ✓':'Concluir missão'} disabled={busy||completed.has(m.id)} onPress={()=>completeMission(m)}/></Panel>):<Empty text="Nenhuma missão disponível por enquanto."/>}<Action title="Gerar plano adaptativo" secondary onPress={()=>setTab('routine')}/></>:
  tab==='shop'?<><Label>THE VAULT / RESGATES</Label><Text style={styles.section}>Loja ASCEND</Text><Text style={styles.subtitle}>Use suas moedas para recompensar seu progresso. Preços confirmados no servidor.</Text><Panel style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><View><Label accent>SALDO DISPONÍVEL</Label><Text style={styles.metric}>◆ {coinsText(shop?.coins)}</Text></View><Text style={{color:C.aqua}}>✓ SEGURO</Text></Panel>{shopCatalog.map(item=><Panel key={item.id}><Label>{item.type}</Label><Text style={styles.cardTitle}>{item.name}</Text><Text style={styles.body}>{item.desc}</Text><View style={styles.split}><Text style={styles.reward}>◆ {item.cost} moedas</Text><Action title={purchasedToday.has(item.id)?'Resgatado':coinsText(item.cost)+' ◆'} disabled={busy||purchasedToday.has(item.id)||(shop?.coins||0)<item.cost} small onPress={()=>buy(item)}/></View></Panel>)}<Action secondary title="Ver inventário e histórico" onPress={()=>setTab('inventory')}/></>:
  tab==='inventory'?<><Label>THE VAULT / INVENTÁRIO</Label><Text style={styles.section}>Suas conquistas</Text>{(shop?.purchases||[]).length?shop.purchases.map((p,i)=><Panel key={String(p.id||i)}><Label>ITEM RESGATADO</Label><Text style={styles.cardTitle}>{p.name}</Text><Text style={styles.body}>{p.day} · {p.cost} moedas</Text></Panel>):<Empty text="Nenhuma compra registrada. Visite a loja para usar suas moedas."/>}</>:
  tab==='routine'?<><Label>PLANEJAMENTO INTELIGENTE</Label><Text style={styles.section}>Sua rotina, suas regras.</Text><Text style={styles.subtitle}>O planejador adapta missões à sua disponibilidade.</Text><Panel><Field label="Objetivos principais" value={goals} onChangeText={setGoals} placeholder="Ex.: estudar 2 horas, treinar..." multiline/><Field label="Como é seu dia?" value={routine} onChangeText={setRoutine} placeholder="Ex.: trabalho de manhã, aulas à tarde..." multiline/><Field label="Minutos livres por dia" value={minutes} onChangeText={setMinutes} keyboardType="numeric"/><Action title={busy?'Gerando...':'Gerar plano do dia'} disabled={busy} onPress={generatePlan}/></Panel>{plan&&<><Panel style={styles.heroCard}><Label accent>SEU PLANO</Label><Text style={styles.cardTitle}>{plan.headline}</Text><Text style={styles.body}>{plan.summary}</Text></Panel>{['dailyMissions','weeklyMissions','monthlyMissions'].map((key)=><View key={key}><Label>{key==='dailyMissions'?'HOJE':key==='weeklyMissions'?'SEMANA':'MÊS'}</Label>{(plan[key]||[]).map(m=><Panel key={m.id}><Text style={styles.cardTitle}>{m.title}</Text><Text style={styles.body}>{m.description}</Text><Text style={styles.reward}>+{m.experienceReward} EXP · +{m.coinReward} moedas</Text>{m.actionable&&<Action title={(plan.completedMissionIds||[]).includes(m.id)?'Concluída ✓':'Concluir'} disabled={busy||(plan.completedMissionIds||[]).includes(m.id)} onPress={()=>completeMission(m)}/>}</Panel>)}</View>)}</>}</>:
  tab==='ai'?<><Label>ASCEND AI / ASSISTENTE</Label><Text style={styles.section}>Seu próximo passo, mais claro.</Text><Text style={styles.subtitle}>Pergunte sobre foco, treino, estudos e organização. O backend usa IA externa quando configurada.</Text><Panel><Text style={styles.body}>Olá! Sou seu assistente. Como posso ajudar hoje?</Text>{conversation.map((m,i)=><View key={i} style={[styles.chatBubble,m.role==='user'&&styles.userBubble]}><Label>{m.role==='user'?'VOCÊ':'ASCEND AI'}</Label><Text style={styles.chatText}>{m.content}</Text></View>)}{chatBusy&&<ActivityIndicator color={C.aqua}/>}<Pressable accessibilityRole="checkbox" accessibilityState={{checked:aiConsent}} onPress={()=>setAiConsent(!aiConsent)} style={{paddingVertical:10,flexDirection:'row',gap:10,alignItems:'center'}}><Text style={{color:C.aqua,fontSize:20}}>{aiConsent?'☑':'☐'}</Text><Text style={[styles.body,{flex:1}]}>Autorizo o envio da pergunta e de contexto ao provedor de IA. Na modalidade gratuita, dados podem ser usados para melhorar o serviço.</Text></Pressable><Field label="Sua pergunta" value={draft} onChangeText={setDraft} multiline placeholder="Como organizar minha semana?"/><Action title={chatBusy?'Pensando...':'Enviar pergunta ✦'} disabled={chatBusy} onPress={sendMessage}/></Panel></>:null}
  </ScrollView>
  {!help&&<View style={styles.bottom}>{menus.map(([id,label,icon])=><Pressable accessibilityRole="tab" accessibilityState={{selected:tab===id}} key={id} onPress={()=>setTab(id)} style={[styles.tab,tab===id&&styles.tabActive]}><Text style={[styles.tabIcon,tab===id&&{color:C.aqua}]}>{icon}</Text><Text style={[styles.tabLabel,tab===id&&{color:C.aqua}]}>{label}</Text></Pressable>)}<Pressable onPress={()=>setTab('inventory')} style={[styles.tab,tab==='inventory'&&styles.tabActive]}><Text style={styles.tabIcon}>▣</Text><Text style={styles.tabLabel}>Itens</Text></Pressable></View>}
  </View>;
}

const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:C.bg,paddingTop:Platform.OS==='ios'?54:36},splash:{flex:1,backgroundColor:C.bg,justifyContent:'center',alignItems:'center'},logo:{fontSize:38,fontWeight:'900',color:C.text,letterSpacing:6,marginTop:15},
 topbar:{paddingHorizontal:21,paddingBottom:17,borderBottomColor:'#24324b',borderBottomWidth:1,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},headerTitle:{color:C.text,fontWeight:'900',fontSize:21,letterSpacing:3},coinPill:{borderColor:'#504936',borderWidth:1,borderRadius:100,paddingHorizontal:11,paddingVertical:9,backgroundColor:'#232330'},circle:{width:38,height:38,borderRadius:19,borderWidth:1,borderColor:C.border,backgroundColor:C.card,alignItems:'center',justifyContent:'center'},circleText:{color:C.aqua,fontSize:21,fontWeight:'900'},
 content:{paddingHorizontal:20,paddingTop:25,paddingBottom:40,gap:13},eyebrow:{color:C.blue,fontSize:10,letterSpacing:2.2,fontWeight:'900',marginBottom:6},section:{color:C.text,fontSize:26,fontWeight:'900',marginBottom:10},hero:{color:C.text,fontSize:30,fontWeight:'900',lineHeight:38,marginBottom:5},subtitle:{color:C.muted,fontSize:14,lineHeight:22,marginBottom:7},body:{color:C.muted,fontSize:14,lineHeight:22,marginVertical:9},
 panel:{padding:18,borderWidth:1,borderColor:C.border,backgroundColor:C.panel,borderRadius:18,marginBottom:3},heroCard:{backgroundColor:'#122941',borderColor:'#31799c'},rank:{color:C.text,fontSize:43,fontWeight:'900',letterSpacing:2},progress:{height:8,borderRadius:9,backgroundColor:'#2b3e56',overflow:'hidden',marginTop:10},progressFill:{height:8,backgroundColor:C.aqua,borderRadius:9},stats:{flexDirection:'row',gap:9},metric:{color:C.text,fontSize:25,fontWeight:'900',marginTop:8},metricUnit:{color:C.muted,fontSize:13},cardTitle:{color:C.text,fontWeight:'800',fontSize:16,lineHeight:23,marginTop:5},
 action:{minHeight:46,paddingHorizontal:14,borderRadius:11,backgroundColor:C.blue,alignItems:'center',justifyContent:'center',marginTop:12},actionText:{fontWeight:'900',color:'#0d2433',fontSize:13,letterSpacing:.2},actionSecondary:{backgroundColor:'#223450',borderWidth:1,borderColor:'#395274'},actionSmall:{minHeight:35,marginTop:0},reward:{color:C.gold,fontWeight:'800',fontSize:12,marginVertical:11},split:{flexDirection:'row',gap:12,alignItems:'center',justifyContent:'space-between'},
 bottom:{flexDirection:'row',borderTopWidth:1,borderTopColor:C.border,backgroundColor:'#0f1829',paddingBottom:Platform.OS==='ios'?21:10,paddingTop:9,paddingHorizontal:6},tab:{alignItems:'center',flex:1,paddingVertical:5,borderRadius:10},tabActive:{backgroundColor:'#1b3048'},tabIcon:{fontSize:19,color:'#899bb8',fontWeight:'900'},tabLabel:{fontSize:9,color:C.muted,marginTop:3,fontWeight:'700'},
 error:{color:C.red,backgroundColor:'#4b1c2a',borderRadius:9,overflow:'hidden',padding:10,marginBottom:8,fontSize:13},input:{borderColor:C.border,borderWidth:1,backgroundColor:'#0b1424',color:C.text,paddingHorizontal:14,paddingVertical:13,borderRadius:10,minHeight:46,fontSize:14},fieldLabel:{color:C.text,fontSize:13,fontWeight:'700',marginBottom:8},empty:{padding:30,color:C.muted,textAlign:'center'},link:{color:C.blue,fontWeight:'800',textAlign:'center'},
 authWrap:{flexGrow:1,justifyContent:'center',paddingHorizontal:25,paddingVertical:50},brand:{color:C.text,fontSize:45,fontWeight:'900',letterSpacing:5,marginVertical:14},authTitle:{color:C.text,fontSize:27,fontWeight:'900',lineHeight:35},authNote:{color:'#657b9c',fontSize:11,textAlign:'center',marginTop:19},chatBubble:{padding:12,backgroundColor:'#203550',borderRadius:12,marginTop:9},userBubble:{backgroundColor:'#164049',alignSelf:'flex-end',maxWidth:'95%'},chatText:{color:C.text,lineHeight:21,fontSize:13},heading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},logout:{position:'absolute',top:Platform.OS==='ios'?56:38,right:178,padding:8}
});
