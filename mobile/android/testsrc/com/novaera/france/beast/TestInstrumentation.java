package com.novaera.france.beast;
import android.app.*;
import android.content.*;
import android.os.*;
import android.view.*;
import android.graphics.Bitmap;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;

public final class TestInstrumentation extends Instrumentation {
    int pass,fail;boolean offlineRecipe;StringBuilder log=new StringBuilder();
    interface Work{void run()throws Exception;}
    void check(String name,Work w){try{w.run();pass++;log.append("PASS ");}catch(Throwable t){fail++;log.append("FAIL ").append(t.getClass().getSimpleName()).append(' ');}log.append(name).append('\n');}
    void yes(boolean value)throws Exception{if(!value)throw new Exception("ASSERT");}
    void rejects(Work w)throws Exception{boolean rejected=false;try{w.run();}catch(Exception e){rejected=true;}yes(rejected);}
    byte[] bytes(JSONObject x){return x.toString().getBytes(StandardCharsets.UTF_8);}
    JSONObject clone(Canon c)throws Exception{return new JSONObject(new String(c.raw,StandardCharsets.UTF_8));}
    boolean hasWeb(View v){if(v.getClass().getName().contains("WebView"))return true;if(v instanceof ViewGroup)for(int i=0;i<((ViewGroup)v).getChildCount();i++)if(hasWeb(((ViewGroup)v).getChildAt(i)))return true;return false;}
    @Override public void onCreate(Bundle args){super.onCreate(args);offlineRecipe="true".equals(args.getString("offline_recipe"));start();}
    @Override public void onStart(){try{
        final Context context=getTargetContext();final Canon base=new Canon(MainActivity.read(context.getAssets().open("canonical-seed.json")));
        check("canonical identity",()->yes(Canon.COUNTRY.equals(base.text("france_binding.country_object_id"))));
        check("DGFiP date preserved",()->yes("2026-09-03".equals(base.text("budget_execution.date_publication"))));
        check("unknown is not zero",()->yes("Inconnu".equals(base.number("absent",2,""))));
        check("null vs real zero",()->{JSONObject d=clone(base);d.getJSONObject("observed").put("nil",JSONObject.NULL).put("zero",0);Canon x=new Canon(bytes(d));yes("Inconnu".equals(x.number("observed.nil",1,"")));yes("0,0".equals(x.number("observed.zero",1,"")));});
        check("idempotent",()->base.replaces(base));
        check("stale rejected",()->{JSONObject d=clone(base);d.put("sequence",base.sequence-1);rejects(()->new Canon(bytes(d)).replaces(base));});
        check("same sequence conflict rejected",()->{JSONObject d=clone(base);d.put("snapshot_id","CONFLICT");rejects(()->new Canon(bytes(d)).replaces(base));});
        check("fresh accepted",()->{JSONObject d=clone(base);d.put("sequence",base.sequence+1).put("updated_at",base.date.plusSeconds(1).toString()).put("snapshot_id","FRESH");new Canon(bytes(d)).replaces(base);});
        check("unadvanced timestamp rejected",()->{JSONObject d=clone(base);d.put("sequence",base.sequence+1);rejects(()->new Canon(bytes(d)).replaces(base));});
        check("boolean sequence rejected",()->{JSONObject d=clone(base);d.put("sequence",true);rejects(()->new Canon(bytes(d)));});
        check("foreign identity rejected",()->{JSONObject d=clone(base);d.put("schema","KRIMI");rejects(()->new Canon(bytes(d)));});
        check("territorial attribution rejected",()->{JSONObject d=clone(base);d.getJSONObject("france_binding").put("territorial_imputation",true);rejects(()->new Canon(bytes(d)));});
        check("political recommendation rejected",()->{JSONObject d=clone(base);d.getJSONObject("policy").put("political_recommendation","BUY");rejects(()->new Canon(bytes(d)));});
        check("future date rejected",()->{JSONObject d=clone(base);d.put("updated_at","2099-01-01T00:00:00Z");rejects(()->new Canon(bytes(d)));});
        for(String type:new String[]{"OBSERVED","DERIVED","HYPOTHESIS","STRESS","UNKNOWN"})check("claim type "+type,()->{JSONObject d=clone(base);d.getJSONArray("claims").getJSONObject(0).put("type",type);yes(type.equals(new Canon(bytes(d)).data.getJSONArray("claims").getJSONObject(0).getString("type")));});
        check("invalid claim type rejected",()->{JSONObject d=clone(base);d.getJSONArray("claims").getJSONObject(0).put("type","PROPHECY");rejects(()->new Canon(bytes(d)));});
        check("foreign output rejected",()->{JSONObject d=clone(base);d.getJSONObject("france_binding").put("output_id","FOREIGN");rejects(()->new Canon(bytes(d)));});
        check("foreign claim system rejected",()->{JSONObject d=clone(base);d.getJSONArray("claims").getJSONObject(0).put("system_id","FOREIGN");rejects(()->new Canon(bytes(d)));});
        check("canonical raw parity",()->{File f=new File(context.getFilesDir(),"CANONICAL_PARITY_ANDROID.json");try(FileOutputStream out=new FileOutputStream(f)){out.write(base.raw);}yes(java.util.Arrays.equals(base.raw,MainActivity.read(new FileInputStream(f))));});
        Intent launch=new Intent(context,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);final MainActivity activity=(MainActivity)startActivitySync(launch);waitForIdleSync();
        check("native activity and no WebView",()->runOnMainSync(()->{if(hasWeb(activity.getWindow().getDecorView()))throw new AssertionError();}));
        waitForIdleSync();
        check("3D drag changes native orbit and reset",()->runOnMainSync(()->{activity.navigate(0);BeastView v=activity.beast;if(v==null)throw new AssertionError();float before=v.renderer.yaw;long t=SystemClock.uptimeMillis();android.view.MotionEvent a=android.view.MotionEvent.obtain(t,t,0,200,200,0);v.dispatchTouchEvent(a);a.recycle();a=android.view.MotionEvent.obtain(t,t+40,2,350,240,0);v.dispatchTouchEvent(a);a.recycle();a=android.view.MotionEvent.obtain(t,t+60,1,350,240,0);v.dispatchTouchEvent(a);a.recycle();if(v.renderer.yaw==before)throw new AssertionError();v.reset();if(v.renderer.yaw!=12||v.renderer.pitch!=8||v.renderer.zoom!=17)throw new AssertionError();}));
        check("3D native pinch changes bounded zoom",()->runOnMainSync(()->{BeastView v=activity.beast;v.reset();long t=SystemClock.uptimeMillis();android.view.MotionEvent.PointerProperties[] p={new android.view.MotionEvent.PointerProperties(),new android.view.MotionEvent.PointerProperties()};for(int i=0;i<2;i++){p[i].id=i;p[i].toolType=1;}android.view.MotionEvent.PointerCoords[] q={new android.view.MotionEvent.PointerCoords(),new android.view.MotionEvent.PointerCoords()};for(int i=0;i<2;i++){q[i].x=200+i*350;q[i].y=200;q[i].pressure=1;q[i].size=1;}int[] actions={0,5|(1<<8),2,2,6|(1<<8),1};for(int i=0;i<actions.length;i++){if(i==2)q[1].x=700;if(i==3)q[1].x=850;int count=i==0||i==5?1:2;android.view.MotionEvent event=android.view.MotionEvent.obtain(t,t+i*50,actions[i],count,p,q,0,0,1,1,0,0,android.view.InputDevice.SOURCE_TOUCHSCREEN,0);v.dispatchTouchEvent(event);event.recycle();}if(v.renderer.zoom==17||v.renderer.zoom<10||v.renderer.zoom>26)throw new AssertionError();v.reset();}));
        check("idempotent network snapshot preserves scene and scroll",()->runOnMainSync(()->{BeastView v=activity.beast;v.renderer.yaw=41;activity.screenScroll.scrollTo(0,80);int y=activity.screenScroll.getScrollY();activity.acceptCandidate(activity.canon);if(activity.beast!=v||v.renderer.yaw!=41||activity.screenScroll.getScrollY()!=y)throw new AssertionError();}));
        check("network outage keeps last good proof and active gesture",()->runOnMainSync(()->{BeastView v=activity.beast;Canon c=activity.canon;activity.showTransport("Réseau indisponible · dernier snapshot valide conservé");if(activity.beast!=v||activity.canon!=c||!activity.clockView.getText().toString().contains(c.text("updated_at")))throw new AssertionError();}));
        check("rejected network candidate preserves retained projection",()->{Canon c=activity.canon;JSONObject d=clone(c);d.put("sequence",c.sequence-1);Canon stale=new Canon(bytes(d));runOnMainSync(()->{BeastView v=activity.beast;activity.acceptCandidate(stale);if(activity.canon!=c||activity.beast!=v||!activity.transport.contains("refusée"))throw new AssertionError();});});
        check("audio silent on launch",()->yes(activity.player==null));
        for(int i=0;i<4;i++){final int p=i;check("native page "+p,()->runOnMainSync(()->{activity.navigate(p);if(activity.body.getChildCount()==0)throw new AssertionError();}));}
        check("audio opt-in and stop",()->{runOnMainSync(activity::startSound);yes(activity.player!=null&&activity.player.isPlaying());runOnMainSync(activity::stopSound);yes(activity.player==null);});
        check("headphone removal stops audio",()->{runOnMainSync(activity::startSound);runOnMainSync(()->activity.noisy.onReceive(context,new Intent(android.media.AudioManager.ACTION_AUDIO_BECOMING_NOISY)));yes(activity.player==null);});
        check("system back returns to pulse",()->runOnMainSync(()->{activity.navigate(2);activity.onBackPressed();if(activity.page!=0)throw new AssertionError();}));
        StringBuilder digest=new StringBuilder();for(byte b:java.security.MessageDigest.getInstance("SHA-256").digest(base.raw))digest.append(String.format("%02x",b&255));log.append("CANONICAL_SHA256 ").append(digest).append('\n');
        check("read-only provider path",()->{ShareProvider p=new ShareProvider();rejects(()->p.file(android.net.Uri.parse("content://com.novaera.france.beast.files/../../private")));});
        check("no camera or microphone permissions",()->{String[] p=context.getPackageManager().getPackageInfo(context.getPackageName(),android.content.pm.PackageManager.GET_PERMISSIONS).requestedPermissions;for(String v:p)yes(!v.contains("CAMERA")&&!v.contains("RECORD_AUDIO"));});
        check("not debuggable",()->yes((context.getApplicationInfo().flags&android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE)==0));
        runOnMainSync(()->activity.navigate(0));waitForIdleSync();
        if(offlineRecipe){runOnMainSync(activity::refresh);SystemClock.sleep(18000);
            check("OS network outage visibly retains last good snapshot",()->runOnMainSync(()->{if(!activity.transport.contains("Réseau indisponible")||activity.canon==null||activity.transportView==null||!activity.transportView.getText().toString().contains("conservé"))throw new AssertionError();}));
            check("offline cache reload preserves exact provenance bytes",()->runOnMainSync(()->{Canon c=activity.canon;activity.canon=null;activity.readCache();if(!java.util.Arrays.equals(c.raw,activity.canon.raw)||!c.date.equals(activity.canon.date)||!activity.transport.contains("âge conservé"))throw new AssertionError();}));
        }
        log.append("TOTAL ").append(pass).append(" PASS ").append(fail).append(" FAIL\n");
        try(FileOutputStream f=new FileOutputStream(new File(context.getFilesDir(),"native-instrumentation.txt"))){f.write(log.toString().getBytes(StandardCharsets.UTF_8));}
    }catch(Throwable t){fail++;log.append("FATAL ").append(t.toString());}Bundle result=new Bundle();result.putString("stream",log.toString());finish(fail==0?Activity.RESULT_OK:Activity.RESULT_CANCELED,result);}
}
