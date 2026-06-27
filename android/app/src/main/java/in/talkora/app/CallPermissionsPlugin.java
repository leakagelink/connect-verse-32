package in.talkora.app;

import android.Manifest;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "CallPermissions",
    permissions = {
        @Permission(alias = CallPermissionsPlugin.MICROPHONE, strings = { Manifest.permission.RECORD_AUDIO }),
        @Permission(alias = CallPermissionsPlugin.CAMERA, strings = { Manifest.permission.CAMERA })
    }
)
public class CallPermissionsPlugin extends Plugin {
    static final String MICROPHONE = "microphone";
    static final String CAMERA = "camera";

    @PluginMethod
    public void check(PluginCall call) {
        call.resolve(currentStates());
    }

    @PluginMethod
    public void request(PluginCall call) {
        String kind = call.getString("kind", "voice");
        if ("video".equals(kind)) {
            if (isGranted(MICROPHONE) && isGranted(CAMERA)) {
                call.resolve(currentStates());
            } else {
                requestPermissionForAliases(new String[] { MICROPHONE, CAMERA }, call, "callPermissionsCallback");
            }
            return;
        }

        if (isGranted(MICROPHONE)) {
            call.resolve(currentStates());
        } else {
            requestPermissionForAlias(MICROPHONE, call, "callPermissionsCallback");
        }
    }

    @PermissionCallback
    private void callPermissionsCallback(PluginCall call) {
        call.resolve(currentStates());
    }

    private JSObject currentStates() {
        JSObject ret = new JSObject();
        ret.put(MICROPHONE, getPermissionState(MICROPHONE).toString());
        ret.put(CAMERA, getPermissionState(CAMERA).toString());
        return ret;
    }

    private boolean isGranted(String alias) {
        return getPermissionState(alias).equals(PermissionState.GRANTED);
    }
}