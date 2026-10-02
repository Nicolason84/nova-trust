package com.novaera.france.beast;

import android.app.*;
import android.content.*;
import android.graphics.*;
import android.graphics.drawable.*;
import android.media.*;
import android.os.*;
import android.view.*;
import android.widget.*;
import android.net.Uri;
import org.json.*;
import java.io.*;
import java.net.*;
import javax.net.ssl.HttpsURLConnection;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;

public class MainActivity extends Activity {
    static final int INK=Color.rgb(7,12,16), PEARL=Color.rgb(232,236,222), COPPER=Color.rgb(224,169,112), JADE=Color.rgb(164,209,186);
    Canon canon; String transport="Chargement du canon…"; int page=0, history=-1;
    LinearLayout body, shell, tabs; BeastView beast; MediaPlayer player; boolean haptic=false, foreground=false, busy=false, light=false;
    float volume=.25f; ExecutorService network=Executors.newSingleThreadExecutor(); Handler handler=new Handler(Looper.getMainLooper());
    final Runnable poll=new Runnable(){public void run(){if(foreground){refresh();handler.postDelayed(this,30000);}}};
    final AudioManager.OnAudioFocusChangeListener focus=change->{if(change<0)stopSound();};
    AudioFocusRequest audioRequest;
    boolean noisyRegistered;
    final BroadcastReceiver noisy=new BroadcastReceiver(){public void onReceive(Context c,Intent i){if(AudioManager.ACTION_AUDIO_BECOMING_NOISY.equals(i.getAction())){stopSound();if(foreground&&page==3)render();}}};
    @Override public void onCreate(Bundle saved){super.onCreate(saved);getWindow().setStatusBarColor(INK);getWindow().setNavigationBarColor(INK);readCache();if(saved!=null)page=saved.getInt("page",0);render();}
    @Override protected void onResume(){super.onResume();foreground=true;registerReceiver(noisy,new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY),android.os.Build.VERSION.SDK_INT>=33?Context.RECEIVER_NOT_EXPORTED:0);noisyRegistered=true;if(beast!=null)beast.onResume();handler.post(poll);}
    @Override protected void onPause(){foreground=false;if(noisyRegistered){unregisterReceiver(noisy);noisyRegistered=false;}handler.removeCallbacks(poll);stopSound();if(beast!=null)beast.onPause();super.onPause();}
    @Override protected void onDestroy(){handler.removeCallbacks(poll);network.shutdownNow();super.onDestroy();}
    @Override protected void onSaveInstanceState(Bundle s){super.onSaveInstanceState(s);s.putInt("page",page);}
    @Override public void onBackPressed(){if(page!=0){page=0;render();}else super.onBackPressed();}
    File cache(){return new File(getCacheDir(),"france-canonical-projection-v1.json");}
    void readCache(){try{canon=new Canon(read(new FileInputStream(cache())));transport="Cache vérifié · âge conservé";}catch(Exception e){try{canon=new Canon(read(getAssets().open("canonical-seed.json")));transport="Snapshot du build · âge conservé";}catch(Exception x){canon=null;}}}
    static byte[] read(InputStream in)throws Exception{try(InputStream s=in;ByteArrayOutputStream b=new ByteArrayOutputStream()){byte[] buf=new byte[8192];int n;while((n=s.read(buf))!=-1){if(b.size()+n>2000000)throw new IOException("OVERSIZE");b.write(buf,0,n);}return b.toByteArray();}}
    void refresh(){if(busy)return;busy=true;network.execute(()->{Canon next=null;String status;try{
        HttpsURLConnection c=(HttpsURLConnection)new URL(Canon.FEED).openConnection();c.setConnectTimeout(12000);c.setReadTimeout(15000);c.setUseCaches(false);
        try{if(c.getResponseCode()!=200)throw new IOException("HTTP");next=new Canon(read(c.getInputStream()));}finally{c.disconnect();}
        final Canon candidate=next;handler.post(()->{try{candidate.replaces(canon);File tmp=new File(getCacheDir(),"canon.tmp");try(FileOutputStream f=new FileOutputStream(tmp)){f.write(candidate.raw);f.getFD().sync();}if(!tmp.renameTo(cache()))throw new IOException("CACHE");canon=candidate;transport="Canon récupéré · états de preuve inchangés";}catch(Exception e){transport="Dernier bon état conservé · version refusée";}busy=false;if(foreground&&page==0)render();});return;
        }catch(Exception e){status="Réseau indisponible · dernier snapshot valide conservé";}final String state=status;handler.post(()->{transport=state;busy=false;if(foreground&&page==0)render();});});}
    int dp(float v){return (int)(v*getResources().getDisplayMetrics().density+.5f);}
    TextView text(String s,float size,int color){TextView t=new TextView(this);t.setText(s);t.setTextSize(size);t.setTextColor(color);t.setLineSpacing(dp(3),1);t.setPadding(0,dp(3),0,dp(7));return t;}
    TextView eyebrow(String s){TextView t=text(s.toUpperCase(Locale.FRANCE),11,COPPER);t.setLetterSpacing(.15f);return t;}
    LinearLayout card(){LinearLayout c=new LinearLayout(this);c.setOrientation(1);c.setPadding(dp(18),dp(16),dp(18),dp(16));GradientDrawable bg=new GradientDrawable();bg.setColor(Color.rgb(18,28,33));bg.setCornerRadius(dp(22));bg.setStroke(dp(1),Color.rgb(66,57,45));c.setBackground(bg);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.bottomMargin=dp(18);body.addView(c,p);return c;}
    Button button(String label,Runnable r){Button b=new Button(this);b.setText(label);b.setAllCaps(false);b.setTextColor(COPPER);b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(28,38,42)));b.setOnClickListener(v->{touch();r.run();});return b;}
    void navigate(int p){if(beast!=null)beast.onPause();page=p;render();}
    void render(){if(beast!=null){beast.onPause();beast=null;}
        shell=new LinearLayout(this);shell.setOrientation(1);shell.setBackground(new GradientDrawable(GradientDrawable.Orientation.TL_BR,new int[]{INK,Color.rgb(19,29,34),INK}));
        shell.setOnApplyWindowInsetsListener((v,insets)->{v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});
        ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);body=new LinearLayout(this);body.setOrientation(1);body.setPadding(dp(22),dp(22),dp(22),dp(18));scroll.addView(body);shell.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        tabs=new LinearLayout(this);for(int i=0;i<4;i++){final int x=i;Button b=button(new String[]{"Pouls","Lecture","Preuves","Présence"}[i],()->navigate(x));b.setTextSize(12);tabs.addView(b,new LinearLayout.LayoutParams(0,dp(58),1));}shell.addView(tabs);setContentView(shell);
        try{if(page==0)pulse();else if(page==1)reading();else if(page==2)evidence(null);else presence();}catch(Exception e){body.addView(text("Lecture indisponible. Le snapshot reste conservé.",18,PEARL));}
    }
    void pulse()throws Exception{
        body.addView(eyebrow("SUPRA × ojO / France / Finances publiques"));TextView title=text("La France\na un pouls.",38,PEARL);title.setTypeface(Typeface.create("serif",Typeface.NORMAL));body.addView(title);
        if(canon==null){body.addView(text(transport,18,COPPER));body.addView(button("Réessayer",this::refresh));return;}
        body.addView(text(canon.number("observed.tec10_pct",3," %"),48,PEARL));body.addView(text("TEC 10 · OBSERVÉ · "+canon.text("observed.tec10_date"),12,JADE));
        LinearLayout c=card();c.addView(eyebrow("Ce qui change"));c.addView(text("10 ans : "+canon.number("decision_delta.delta_bps.10",1," pb")+" depuis l’observation précédente.",21,PEARL));c.addView(text(canon.text("decision_delta.status")+" · "+canon.text("decision_delta.confidence"),12,JADE));c.addView(button("Ouvrir la preuve Banque de France",()->{navigate(2);}));
        boolean reduced=android.provider.Settings.Global.getFloat(getContentResolver(),android.provider.Settings.Global.ANIMATOR_DURATION_SCALE,1)==0||((PowerManager)getSystemService(POWER_SERVICE)).isPowerSaveMode();
        LinearLayout stage=card();stage.addView(eyebrow("La Bête · huit voies de transmission"));
        final TextView detail=text(BeastView.DETAILS[0],12,PEARL);
        if(light||reduced){stage.addView(new OrbitFallback(this),new LinearLayout.LayoutParams(-1,dp(230)));}else{beast=new BeastView(this);beast.select=i->runOnUiThread(()->{detail.setText(BeastView.LABELS[i]+" · "+BeastView.DETAILS[i]);touch();});stage.addView(beast,new LinearLayout.LayoutParams(-1,dp(260)));if(foreground)beast.onResume();}
        Spinner arms=new Spinner(this);arms.setAdapter(new ArrayAdapter<String>(this,android.R.layout.simple_spinner_dropdown_item,BeastView.LABELS));arms.setContentDescription("Sélection des huit bras de la Bête");arms.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener(){public void onNothingSelected(AdapterView<?>p){}public void onItemSelected(AdapterView<?>p,View v,int i,long id){detail.setText(BeastView.DETAILS[i]);}});stage.addView(arms);stage.addView(detail);
        stage.addView(button("Recentrer",()->{if(beast!=null)beast.reset();}));stage.addView(button(light?"Rendu 3D":"Mode léger",()->{light=!light;render();}));
        c=card();c.addView(eyebrow("Horizon · incertitude"));c.addView(text("Le marché se transmet au stock par les émissions et le refinancement, progressivement.",18,PEARL));c.addView(text("Échéancier : "+canon.text("maturity_ladder.mode")+". Coût moyen du stock : inconnu dans ce feed.",13,COPPER));c.addView(text("Un signal national ne prouve aucun effet régional.",12,PEARL));
        c=card();c.addView(eyebrow("Trois horloges"));c.addView(text("Marché : "+canon.text("observed.tec10_date")+"\nÉtat matériel : "+canon.text("updated_at")+"\nÂge : "+Math.max(0,Duration.between(canon.date,Instant.now()).toMinutes())+" min",13,PEARL));c.addView(text("Runner : non observé par ce client. L’ouverture de l’app ne prouve aucune exécution serveur.",12,COPPER));c.addView(text(transport,12,JADE));
        body.addView(button("Actualiser le canon",this::refresh));body.addView(button("Partager le snapshot et ses preuves",this::share));
    }
    void reading()throws Exception{
        body.addView(eyebrow("D’un signal à la transmission"));body.addView(text("Le temps change\nla lecture.",34,PEARL));if(canon==null)return;
        JSONArray h=(JSONArray)canon.value("curve_history");if(history<0)history=h.length()-1;history=Math.min(history,h.length()-1);
        JSONObject point=h.length()>0?h.getJSONObject(history):null;JSONArray curve=point!=null?point.getJSONArray("curve"):(JSONArray)canon.value("observed.yield_curve");
        LinearLayout c=card();c.addView(eyebrow("Courbe TEC · %"));c.addView(text(point!=null?point.optString("date","Inconnu"):canon.text("observed.yield_curve_date"),13,JADE));c.addView(new CurveView(this,curve),new LinearLayout.LayoutParams(-1,dp(170)));
        SeekBar seek=new SeekBar(this);seek.setMax(Math.max(0,h.length()-1));seek.setProgress(Math.max(0,history));seek.setContentDescription("Chronologie des observations TEC");seek.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){public void onProgressChanged(SeekBar b,int p,boolean user){if(user)history=p;}public void onStartTrackingTouch(SeekBar b){}public void onStopTrackingTouch(SeekBar b){render();}});c.addView(seek);
        for(int i=0;i<curve.length();i++){JSONObject p=curve.getJSONObject(i);c.addView(text(Canon.shown(p,"tenor_years")+" ans · "+Canon.shown(p,"rate_pct")+" %",12,PEARL));}
        c=card();c.addView(eyebrow("Refinancement · horizons canoniques"));JSONArray views=(JSONArray)canon.value("refinancing_twin.views");for(int i=0;i<views.length();i++){JSONObject v=views.getJSONObject(i);c.addView(text(Canon.shown(v,"horizon_months")+" mois · "+Canon.shown(v,"maturity_stock_bne")+" Md€ d’encours",18,PEARL));c.addView(text(v.optString("coverage","UNKNOWN"),11,COPPER));}c.addView(text(canon.text("maturity_ladder.note"),12,PEARL));
        c=card();c.addView(eyebrow("Échéancier · encours conservés"));JSONArray years=(JSONArray)canon.value("maturity_ladder.years");for(int i=0;i<years.length();i++){JSONObject v=years.getJSONObject(i);c.addView(text(Canon.shown(v,"year")+" · OAT "+Canon.shown(v,"oat_nominal_bne")+" Md€\nOATi "+Canon.shown(v,"oati_bne")+" · OAT€i "+Canon.shown(v,"oatei_bne"),14,PEARL));}
        c=card();c.addView(eyebrow("Stress +100 pb · PAP 2026"));c.addView(text("Sensibilité publiée, pas une prévision.",17,PEARL));JSONArray vals=(JSONArray)canon.value("sensitivity.pap2026.annual_extra_charge_bne");for(int i=0;i<vals.length();i++)c.addView(text("Année "+(i+1)+" · "+vals.get(i)+" Md€ / an",13,PEARL));
        JSONObject shapes=(JSONObject)canon.value("sensitivity.stress_shapes");Iterator<String> keys=shapes.keys();while(keys.hasNext()){String k=keys.next();JSONObject s=shapes.getJSONObject(k);c.addView(button(s.optString("label",k),()->new AlertDialog.Builder(this).setTitle(s.optString("label",k)+" · STRESS").setMessage(s.optJSONObject("tenor_shock_bps").toString()+"\nChocs en pb par tenor. Aucun calcul financier mobile ajouté.").setPositiveButton("Fermer",null).show()));}
        c=card();c.addView(eyebrow("Exécution budgétaire"));c.addView(text(canon.text("budget_execution.titre_document"),18,PEARL));c.addView(text("Publié : "+canon.text("budget_execution.date_publication")+" · "+canon.text("budget_execution.publication_date_state"),12,JADE));c.addView(button("Lire le PDF DGFiP",()->open(canon.text("budget_execution.url_fichier"))));
    }
    void evidence(String only)throws Exception{
        body.addView(eyebrow("Chaque signal a une origine"));body.addView(text("Ouvrir la boîte\nde preuves.",34,PEARL));if(canon==null)return;
        JSONArray claims=canon.data.getJSONArray("claims");for(int i=0;i<claims.length();i++){JSONObject claim=claims.getJSONObject(i);if(only!=null&&!only.equals(claim.optString("claim_id")))continue;LinearLayout c=card();c.addView(eyebrow(claim.optString("type","UNKNOWN")+" · "+claim.optString("state","UNKNOWN")));c.addView(text(claim.optString("label","Claim"),20,PEARL));c.addView(text("Vintage : "+claim.optString("date","Inconnu")+" · confiance : "+claim.optString("confidence","UNKNOWN"),12,JADE));c.addView(text("Observation : "+claim.optString("observation_id","Inconnu")+"\nTransformation : "+claim.optString("transformation_id","Inconnu"),11,PEARL));JSONArray proofs=claim.getJSONArray("proof");for(int j=0;j<proofs.length();j++)source(c,proofs.getJSONObject(j));}
        JSONArray sources=canon.data.getJSONArray("sources");for(int i=0;i<sources.length();i++)source(card(),sources.getJSONObject(i));
        LinearLayout c=card();c.addView(eyebrow("ProofGraph · relations canoniques"));JSONArray edges=canon.data.getJSONObject("evidence_graph").getJSONArray("edges");for(int i=0;i<edges.length();i++){JSONObject e=edges.getJSONObject(i);c.addView(text(e.optString("from")+" → "+e.optString("relation")+" → "+e.optString("to"),11,PEARL));}
        JSONArray conditions=(JSONArray)canon.value("what_would_change_the_reading");for(int i=0;i<conditions.length();i++){JSONObject x=conditions.getJSONObject(i);c=card();c.addView(text(x.optString("reading"),16,PEARL));c.addView(text(x.optJSONArray("change_conditions").toString(),12,COPPER));}
        body.addView(text(canon.id+" · séquence "+canon.sequence+"\nFrance → Finances publiques → Dette / Taux / Refinancement",11,JADE));
    }
    void source(LinearLayout c,JSONObject s){c.addView(text(s.optString("label",s.optString("publisher","Source")),16,PEARL));c.addView(text(s.optString("health","UNKNOWN")+" · "+s.optString("vintage",s.optString("observation_date","Vintage non précisé")),11,JADE));c.addView(text("Vérifiée : "+s.optString("checked_at","Non renseigné"),11,PEARL));for(String k:new String[]{"reason","error","replacement_condition"})if(!s.isNull(k)&&s.has(k))c.addView(text(s.optString(k),11,COPPER));if(s.optString("url").startsWith("https://"))c.addView(button("Ouvrir la source officielle ↗",()->open(s.optString("url"))));}
    void presence(){body.addView(eyebrow("La Bête, à votre rythme"));body.addView(text("Une respiration.\nÀ votre demande.",34,PEARL));LinearLayout c=card();c.addView(button(player==null?"Faire résonner":"Arrêter la résonance",()->{if(player==null)startSound();else stopSound();render();}));c.addView(text("Grave doux, harmoniques, respiration. Texture artistique indépendante des données.",14,PEARL));SeekBar v=new SeekBar(this);v.setMax(50);v.setProgress((int)(volume*100));v.setContentDescription("Volume sonore borné à cinquante pour cent");v.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){public void onProgressChanged(SeekBar b,int p,boolean u){volume=Math.min(.5f,p/100f);if(player!=null)player.setVolume(volume,volume);}public void onStartTrackingTouch(SeekBar b){}public void onStopTrackingTouch(SeekBar b){}});c.addView(v);
        Switch toggle=new Switch(this);toggle.setText("Retour tactile sur sélection");toggle.setTextColor(PEARL);toggle.setChecked(haptic);Vibrator vib=(Vibrator)getSystemService(VIBRATOR_SERVICE);toggle.setEnabled(vib!=null&&vib.hasVibrator());toggle.setOnCheckedChangeListener((b,on)->{haptic=on;touch();});c.addView(toggle);c.addView(text("Bref retour de geste. Les paramètres OS sont respectés. Vibration physique non certifiée sur émulateur.",12,COPPER));body.addView(text("Arrêt en arrière-plan, à la perte de focus audio ou au retrait du casque. Aucun redémarrage automatique. Aucun accès micro ou caméra.",14,PEARL));}
    void startSound(){try{AudioManager am=(AudioManager)getSystemService(AUDIO_SERVICE);audioRequest=new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN).setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build()).setOnAudioFocusChangeListener(focus).build();if(am.requestAudioFocus(audioRequest)!=AudioManager.AUDIOFOCUS_REQUEST_GRANTED)return;
        player=new MediaPlayer();android.content.res.AssetFileDescriptor f=getAssets().openFd("resonance.wav");player.setDataSource(f.getFileDescriptor(),f.getStartOffset(),f.getLength());f.close();player.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).build());player.setLooping(true);player.setVolume(volume,volume);player.prepare();player.start();}catch(Exception e){stopSound();Toast.makeText(this,"Son indisponible",Toast.LENGTH_SHORT).show();}}
    void stopSound(){if(player!=null){player.release();player=null;}if(audioRequest!=null){((AudioManager)getSystemService(AUDIO_SERVICE)).abandonAudioFocusRequest(audioRequest);audioRequest=null;}}
    void touch(){if(haptic&&foreground)body.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK);}
    void open(String url){if(!url.startsWith("https://"))return;try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)));}catch(Exception e){Toast.makeText(this,"Aucun lecteur de source disponible",Toast.LENGTH_SHORT).show();}}
    void share(){if(canon==null)return;try{File f=new File(getCacheDir(),"france-export.json");try(FileOutputStream s=new FileOutputStream(f)){s.write(canon.raw);}Intent i=new Intent(Intent.ACTION_SEND);i.setType("application/json");i.putExtra(Intent.EXTRA_STREAM,Uri.parse("content://com.novaera.france.beast.files/france-export.json"));i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);startActivity(Intent.createChooser(i,"Partager ce snapshot canonique"));}catch(Exception e){Toast.makeText(this,"Export indisponible",Toast.LENGTH_SHORT).show();}}
    static class OrbitFallback extends View{Paint p=new Paint(3);OrbitFallback(Context c){super(c);setContentDescription("Mode léger : stock central et cinq horizons");}protected void onDraw(Canvas c){float x=getWidth()/2f,y=getHeight()/2f;p.setStyle(Paint.Style.STROKE);p.setColor(COPPER);p.setStrokeWidth(1);for(int i=0;i<5;i++)c.drawOval(x-50-i*13,y-30-i*13,x+50+i*13,y+30+i*13,p);p.setStyle(Paint.Style.FILL);p.setTextAlign(Paint.Align.CENTER);p.setTextSize(30);p.setColor(PEARL);c.drawText("FRANCE",x,y+10,p);}}
    static class CurveView extends View{JSONArray data;Paint p=new Paint(3);CurveView(Context c,JSONArray a){super(c);data=a;setContentDescription("Courbe TEC. Toutes les valeurs sont disponibles en texte sous le graphique.");}protected void onDraw(Canvas c){float w=getWidth(),h=getHeight();p.setColor(COPPER);p.setStrokeWidth(4);p.setStyle(Paint.Style.STROKE);Path path=new Path();boolean first=true;for(int i=0;i<data.length();i++){JSONObject v=data.optJSONObject(i);Object x=v.opt("tenor_years"),y=v.opt("rate_pct");if(!(x instanceof Number)||!(y instanceof Number))continue;float px=16+((Number)x).floatValue()/30*(w-32),py=h-20-((Number)y).floatValue()/8*(h-40);if(first){path.moveTo(px,py);first=false;}else path.lineTo(px,py);}c.drawPath(path,p);}}
}
