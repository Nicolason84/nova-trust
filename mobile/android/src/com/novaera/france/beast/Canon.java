package com.novaera.france.beast;

import org.json.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

public final class Canon {
    public static final String FEED = "https://nicolason84.github.io/nova-trust/data/france-debt-rate-live.json";
    public static final String COUNTRY = "OJO_FRANCE_ORGANISM_V1#/identity";
    public static final String SYSTEM = "OJO_FRANCE_ORGANISM_V1#/physiology/systems/finance";
    public final JSONObject data;
    public final byte[] raw;
    public final long sequence;
    public final Instant date;
    public final String id;
    public Canon(byte[] raw) throws Exception {
        if (raw.length > 2000000) throw new Exception("OVERSIZE");
        data = new JSONObject(new String(raw, StandardCharsets.UTF_8));
        this.raw = raw;
        if (!"OJO_FRANCE_DEBT_RATE_LIVE_V1".equals(data.optString("schema"))) throw new Exception("SCHEMA");
        Object n = data.get("sequence");
        if (!(n instanceof Number) || ((Number)n).doubleValue() != ((Number)n).longValue() || ((Number)n).longValue() < 0) throw new Exception("SEQUENCE");
        sequence = ((Number)n).longValue(); id = data.getString("snapshot_id"); if(id.isEmpty()) throw new Exception("IDENTITY");
        date = Instant.parse(data.getString("updated_at")); if(date.isAfter(Instant.now().plusSeconds(300))) throw new Exception("FUTURE");
        JSONObject b = data.getJSONObject("france_binding");
        if(!COUNTRY.equals(b.optString("country_object_id")) || !SYSTEM.equals(b.optString("system_id")) || !"OJO_FRANCE_DEBT_RATE_LIVE_V1".equals(b.optString("organ_id")) || !"NATIONAL_ONLY".equals(b.optString("territorial_scope")) || !Boolean.FALSE.equals(b.opt("territorial_imputation")) || !"EXECUTIVE_OUTPUT".equals(b.optString("output_id"))) throw new Exception("BINDING");
        if(!"NONE".equals(data.getJSONObject("policy").optString("political_recommendation"))) throw new Exception("POLICY");
        data.getJSONObject("observed"); data.getJSONObject("evidence_graph");
        JSONArray claims = data.getJSONArray("claims"), sources = data.getJSONArray("sources");
        if(claims.length()==0 || sources.length()==0) throw new Exception("EVIDENCE");
        HashSet<String> ids = new HashSet<>();
        for(int i=0;i<claims.length();i++) {
            JSONObject c=claims.getJSONObject(i);
            if(!ids.add(c.getString("claim_id")) || !Arrays.asList("OBSERVED","DERIVED","HYPOTHESIS","STRESS","UNKNOWN").contains(c.getString("type")) || !COUNTRY.equals(c.optString("country_object_id")) || !"OJO_FRANCE_DEBT_RATE_LIVE_V1".equals(c.optString("organ_id")) || !SYSTEM.equals(c.optString("system_id")) || !"EXECUTIVE_OUTPUT".equals(c.optString("output_id"))) throw new Exception("CLAIM");
            c.getJSONArray("proof");
        }
    }
    public void replaces(Canon old) throws Exception {
        if(old==null)return;
        if(sequence<old.sequence || date.isBefore(old.date)) throw new Exception("STALE");
        if(sequence==old.sequence && !normalized(data).equals(normalized(old.data))) throw new Exception("CONFLICT");
        if(sequence>old.sequence && !date.isAfter(old.date)) throw new Exception("NON_MONOTONE");
    }
    public static String normalized(Object o) throws JSONException {
        if(o instanceof JSONObject) {
            JSONObject j=(JSONObject)o; ArrayList<String> keys=new ArrayList<>();j.keys().forEachRemaining(keys::add);Collections.sort(keys);
            StringBuilder s=new StringBuilder("{");for(String k:keys)s.append(JSONObject.quote(k)).append(':').append(normalized(j.get(k))).append(',');return s.append('}').toString();
        }
        if(o instanceof JSONArray) {StringBuilder s=new StringBuilder("[");JSONArray a=(JSONArray)o;for(int i=0;i<a.length();i++)s.append(normalized(a.get(i))).append(',');return s.append(']').toString();}
        return o==null || o==JSONObject.NULL ? "null" : o instanceof String ? JSONObject.quote((String)o) : String.valueOf(o);
    }
    public Object value(String path) {
        Object v=data;for(String p:path.split("\\.")){ if(!(v instanceof JSONObject))return null;v=((JSONObject)v).opt(p); }return v==JSONObject.NULL?null:v;
    }
    public String text(String path) { Object v=value(path);return v instanceof String?(String)v:"Inconnu"; }
    public String number(String path,int places,String suffix) {
        Object n=value(path);return n instanceof Number && Double.isFinite(((Number)n).doubleValue())?String.format(Locale.FRANCE,"%."+places+"f",((Number)n).doubleValue())+suffix:"Inconnu";
    }
    public static String shown(JSONObject d,String k) {Object v=d.opt(k);return v==null||v==JSONObject.NULL?"Inconnu":String.valueOf(v);}
}
