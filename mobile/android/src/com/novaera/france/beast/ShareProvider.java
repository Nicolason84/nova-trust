package com.novaera.france.beast;
import android.content.*;
import android.database.*;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.*;

// Narrow adaptation of the non-exported, grant-based KRIMI native sharing contract.
public final class ShareProvider extends ContentProvider {
    public boolean onCreate(){return true;}
    File file(Uri u)throws FileNotFoundException{if(!"/france-export.json".equals(u.getPath())||u.getQuery()!=null||u.getFragment()!=null)throw new FileNotFoundException("PATH");return new File(getContext().getCacheDir(),"france-export.json");}
    public String getType(Uri u){return "application/json";}
    public ParcelFileDescriptor openFile(Uri u,String mode)throws FileNotFoundException{if(!"r".equals(mode))throw new FileNotFoundException("READ_ONLY");return ParcelFileDescriptor.open(file(u),ParcelFileDescriptor.MODE_READ_ONLY);}
    public Cursor query(Uri u,String[] p,String s,String[] a,String order){try{File f=file(u);MatrixCursor c=new MatrixCursor(new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE});c.addRow(new Object[]{f.getName(),f.length()});return c;}catch(Exception e){return null;}}
    public Uri insert(Uri u,ContentValues v){throw new UnsupportedOperationException();}
    public int update(Uri u,ContentValues v,String s,String[] a){throw new UnsupportedOperationException();}
    public int delete(Uri u,String s,String[] a){throw new UnsupportedOperationException();}
}
