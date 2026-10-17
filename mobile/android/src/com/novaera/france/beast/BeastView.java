package com.novaera.france.beast;
import android.content.Context;
import android.opengl.*;
import android.view.*;
import java.nio.*;
import java.util.*;
import javax.microedition.khronos.egl.EGLConfig;
import javax.microedition.khronos.opengles.GL10;

public final class BeastView extends GLSurfaceView {
    public static final String[] LABELS={"Marché","Refinancement","Émissions","Intérêts","Stock","Maturité","Déficit","Temps"};
    public static final String[] DETAILS={"Courbe des taux : signal observé, pas causalité.","Échéances : vitesse de transmission au stock.","Besoin nouveau : volume exposé aux conditions courantes.","Charge : résultat budgétaire de la transmission.","Dette existante : mémoire des coupons passés.","Durée de vie : amortisseur temporel du portefeuille.","Besoin de financement : flux à couvrir.","Persistance : variable qui transforme un signal en coût durable."};
    interface Select{void arm(int i);} Select select;
    final Art renderer=new Art();float lastX,lastY,startX,startY;boolean scaling;
    ScaleGestureDetector pinch;
    public BeastView(Context c){super(c);setEGLContextClientVersion(2);setRenderer(renderer);setRenderMode(RENDERMODE_WHEN_DIRTY);setPreserveEGLContextOnPause(true);setContentDescription("Bête 3D native : glisser pour tourner, pincer pour zoomer, toucher les extrémités des huit bras.");
        pinch=new ScaleGestureDetector(c,new ScaleGestureDetector.SimpleOnScaleGestureListener(){public boolean onScale(ScaleGestureDetector d){renderer.zoom=Math.max(10,Math.min(26,renderer.zoom/d.getScaleFactor()));requestRender();scaling=true;return true;}});}
    public void reset(){renderer.yaw=12;renderer.pitch=8;renderer.zoom=17;requestRender();}
    @Override public boolean onTouchEvent(MotionEvent e){pinch.onTouchEvent(e);switch(e.getActionMasked()){
        case MotionEvent.ACTION_DOWN:lastX=startX=e.getX();lastY=startY=e.getY();scaling=false;getParent().requestDisallowInterceptTouchEvent(true);return true;
        case MotionEvent.ACTION_MOVE:if(!pinch.isInProgress()&&e.getPointerCount()==1){renderer.yaw+=(e.getX()-lastX)*.4f;renderer.pitch=Math.max(-75,Math.min(75,renderer.pitch+(e.getY()-lastY)*.4f));requestRender();}lastX=e.getX();lastY=e.getY();return true;
        case MotionEvent.ACTION_UP:getParent().requestDisallowInterceptTouchEvent(false);if(!scaling&&Math.hypot(e.getX()-startX,e.getY()-startY)<15){int i=renderer.hit(e.getX(),e.getY());if(i>=0&&select!=null)select.arm(i);performClick();}return true;
        default:return true;}}
    @Override public boolean performClick(){return super.performClick();}
    static class Mesh {FloatBuffer vertices;int count,mode;float[] color;Mesh(ArrayList<Float> a,int mode,float[] color){vertices=ByteBuffer.allocateDirect(a.size()*4).order(ByteOrder.nativeOrder()).asFloatBuffer();for(float f:a)vertices.put(f);vertices.position(0);count=a.size()/3;this.mode=mode;this.color=color;}}
    static class Art implements Renderer{
        volatile float yaw=12,pitch=8,zoom=17;int program,w,h;float[] combined=new float[16],projection=new float[16],view=new float[16],model=new float[16],vp=new float[16];ArrayList<Mesh> meshes=new ArrayList<>();float[][] tips=new float[8][4];
        public void onSurfaceCreated(GL10 gl,EGLConfig config){String vs="attribute vec3 p;uniform mat4 m;varying float light;void main(){light=0.45+0.55*max(0.0,dot(normalize(p),normalize(vec3(0.4,0.7,1.0))));gl_Position=m*vec4(p,1.0);}";String fs="precision mediump float;uniform vec4 c;varying float light;void main(){gl_FragColor=vec4(c.rgb*light,c.a);}";program=GLES20.glCreateProgram();GLES20.glAttachShader(program,shader(GLES20.GL_VERTEX_SHADER,vs));GLES20.glAttachShader(program,shader(GLES20.GL_FRAGMENT_SHADER,fs));GLES20.glLinkProgram(program);int[] ok=new int[1];GLES20.glGetProgramiv(program,GLES20.GL_LINK_STATUS,ok,0);if(ok[0]==0)throw new IllegalStateException(GLES20.glGetProgramInfoLog(program));GLES20.glEnable(GLES20.GL_DEPTH_TEST);GLES20.glEnable(GLES20.GL_BLEND);GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA,GLES20.GL_ONE_MINUS_SRC_ALPHA);meshes.clear();sphere();rings();arms();}
        int shader(int type,String s){int x=GLES20.glCreateShader(type);GLES20.glShaderSource(x,s);GLES20.glCompileShader(x);int[] ok=new int[1];GLES20.glGetShaderiv(x,GLES20.GL_COMPILE_STATUS,ok,0);if(ok[0]==0)throw new IllegalStateException(GLES20.glGetShaderInfoLog(x));return x;}
        void put(ArrayList<Float>a,double x,double y,double z){a.add((float)x);a.add((float)y);a.add((float)z);}
        void sphere(){for(int lat=0;lat<24;lat++){ArrayList<Float>a=new ArrayList<>();for(int lon=0;lon<=48;lon++)for(int j=0;j<2;j++){double b=(lat+j)*Math.PI/24-Math.PI/2,t=lon*Math.PI/24;put(a,2.1*Math.cos(b)*Math.cos(t),2.1*Math.sin(b),2.1*Math.cos(b)*Math.sin(t));}meshes.add(new Mesh(a,GLES20.GL_TRIANGLE_STRIP,new float[]{.25f,.47f,.52f,1}));}}
        void rings(){for(int i=0;i<5;i++){ArrayList<Float>a=new ArrayList<>();double r=2.8+i*.62;for(int n=0;n<=128;n++){double t=n*Math.PI/64;put(a,r*Math.cos(t),r*Math.sin(t)*Math.sin(i*.18),r*Math.sin(t)*Math.cos(i*.18));}meshes.add(new Mesh(a,GLES20.GL_LINE_STRIP,i<2?new float[]{.55f,.8f,.84f,.4f}:new float[]{.88f,.66f,.44f,.45f}));}}
        void arms(){for(int i=0;i<8;i++){ArrayList<Float>a=new ArrayList<>();double angle=i*Math.PI/4;for(int n=0;n<=48;n++){double t=n/48.0,r=1.85+2.8*t;double x=r*Math.cos(angle)+Math.sin(angle*1.7)*.65*t*t,y=r*Math.sin(angle)*.55+Math.cos(angle*1.3)*.7*t*t,z=r*Math.sin(angle)*.55+Math.sin(angle*2)*.3*t;put(a,x,y,z);if(n==48)tips[i]=new float[]{(float)x,(float)y,(float)z,1};}meshes.add(new Mesh(a,GLES20.GL_LINE_STRIP,i%2==0?new float[]{.64f,.82f,.73f,1}:new float[]{.55f,.8f,.84f,1}));}}
        public void onSurfaceChanged(GL10 gl,int width,int height){w=width;h=height;GLES20.glViewport(0,0,w,h);Matrix.perspectiveM(projection,0,44,width/(float)height,.1f,100);}
        public void onDrawFrame(GL10 gl){GLES20.glClearColor(.027f,.047f,.063f,1);GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT|GLES20.GL_DEPTH_BUFFER_BIT);Matrix.setLookAtM(view,0,0,1,zoom,0,0,0,0,1,0);Matrix.setIdentityM(model,0);Matrix.rotateM(model,0,pitch,1,0,0);Matrix.rotateM(model,0,yaw,0,1,0);Matrix.multiplyMM(vp,0,projection,0,view,0);Matrix.multiplyMM(combined,0,vp,0,model,0);GLES20.glUseProgram(program);int loc=GLES20.glGetAttribLocation(program,"p");GLES20.glUniformMatrix4fv(GLES20.glGetUniformLocation(program,"m"),1,false,combined,0);GLES20.glEnableVertexAttribArray(loc);GLES20.glLineWidth(3);for(Mesh m:meshes){GLES20.glUniform4fv(GLES20.glGetUniformLocation(program,"c"),1,m.color,0);GLES20.glVertexAttribPointer(loc,3,GLES20.GL_FLOAT,false,0,m.vertices);GLES20.glDrawArrays(m.mode,0,m.count);}GLES20.glDisableVertexAttribArray(loc);}
        int hit(float x,float y){float min=70;int selected=-1;for(int i=0;i<8;i++){float[] p=new float[4];Matrix.multiplyMV(p,0,combined,0,tips[i],0);if(p[3]<=0)continue;float sx=(p[0]/p[3]+1)*w/2,sy=(1-p[1]/p[3])*h/2;float d=(float)Math.hypot(x-sx,y-sy);if(d<min){min=d;selected=i;}}return selected;}
    }
}
