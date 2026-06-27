/**
 * 100ms RTC client wrapper — mirrors the public surface of AgoraSession so
 * the call screen can swap providers without major branching.
 *
 * 100ms doesn't hand out raw MediaStream objects for its published tracks
 * (the SDK manages capture internally), so the local preview and remote
 * video are rendered via `attachLocalVideo` / `attachRemoteVideo` instead
 * of `<video srcObject>`. ModerationSampler is disabled on 100ms calls
 * (it needs a raw MediaStream).
 */
import type {
  HMSReactiveStore as HMSReactiveStoreType,
  HMSActions,
  HMSStore,
  HMSPeer,
} from "@100mslive/hms-video-store";

export type HmsEvents = {
  onRemoteJoined?: () => void;
  onRemoteLeft?: () => void;
  /** 0=unknown, 1=excellent ... 5=worst (we normalize to Agora's 1..6 scale: 6=down). */
  onQuality?: (q: number) => void;
  onDisconnected?: () => void;
  onReconnected?: () => void;
  onVideoFallback?: () => void;
};

export class HmsSession {
  private store: HMSReactiveStoreType | null = null;
  private actions: HMSActions | null = null;
  private hmsStore: HMSStore | null = null;
  private unsubscribes: Array<() => void> = [];
  private events: HmsEvents = {};
  private channel = "";
  private kind: "voice" | "video" = "video";
  private disconnects = 0;
  private qualitySum = 0;
  private qualityCount = 0;
  private localVideoEl: HTMLVideoElement | null = null;
  private remoteContainerEl: HTMLElement | null = null;
  private remoteVideoEl: HTMLVideoElement | null = null;
  private attachedLocalTrackId: string | null = null;
  private attachedRemoteTrackId: string | null = null;
  private wasConnected = false;

  async join(opts: {
    token: string;
    userName: string;
    channel: string;
    kind: "voice" | "video";
    events?: HmsEvents;
  }): Promise<void> {
    this.kind = opts.kind;
    this.channel = opts.channel;
    this.events = opts.events ?? {};

    const mod = await import("@100mslive/hms-video-store");
    this.store = new mod.HMSReactiveStore();
    this.store.triggerOnSubscribe();
    this.actions = this.store.getActions();
    this.hmsStore = this.store.getStore();

    // Watch connection state — counts reconnects as disconnects.
    this.unsubscribes.push(
      this.hmsStore.subscribe((connected: boolean | undefined) => {
        if (connected) {
          if (this.wasConnected) this.events.onReconnected?.();
          this.wasConnected = true;
        } else if (this.wasConnected) {
          this.disconnects += 1;
          this.events.onDisconnected?.();
        }
      }, mod.selectIsConnectedToRoom),
    );

    // Watch peers — fire remote join/left + reattach video on track changes.
    this.unsubscribes.push(
      this.hmsStore.subscribe((peers: HMSPeer[]) => {
        const remote = peers.find((p) => !p.isLocal);
        if (remote) {
          this.events.onRemoteJoined?.();
          if (this.kind === "video" && remote.videoTrack) {
            this.tryAttachRemote(remote.videoTrack);
          }
        } else if (this.wasConnected) {
          this.events.onRemoteLeft?.();
          this.attachedRemoteTrackId = null;
        }
        // Local video track may appear after enable; attach when available.
        const local = peers.find((p) => p.isLocal);
        if (local?.videoTrack && this.kind === "video") {
          this.tryAttachLocal(local.videoTrack);
        }
      }, mod.selectPeers),
    );

    await this.actions.join({
      userName: opts.userName,
      authToken: opts.token,
      settings: {
        isAudioMuted: false,
        isVideoMuted: opts.kind !== "video",
      },
    });
  }

  /** Attach local video preview to a <video> element. */
  attachLocalVideo(el: HTMLVideoElement) {
    this.localVideoEl = el;
    if (!this.hmsStore || !this.actions) return;
    const mod = require("@100mslive/hms-video-store");
    const peers = this.hmsStore.getState(mod.selectPeers) as HMSPeer[];
    const local = peers.find((p) => p.isLocal);
    if (local?.videoTrack) this.tryAttachLocal(local.videoTrack);
  }

  /** Attach remote video to a container element (we create a <video> inside). */
  attachRemoteVideo(container: HTMLElement) {
    this.remoteContainerEl = container;
    // Build (or reuse) a <video> inside the container.
    let v = container.querySelector("video[data-hms-remote]") as HTMLVideoElement | null;
    if (!v) {
      v = document.createElement("video");
      v.setAttribute("data-hms-remote", "1");
      v.autoplay = true;
      v.playsInline = true;
      v.style.width = "100%";
      v.style.height = "100%";
      v.style.objectFit = "cover";
      container.appendChild(v);
    }
    this.remoteVideoEl = v;
    if (!this.hmsStore) return;
    // Use require here is fine because the module is already loaded by join().
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("@100mslive/hms-video-store");
    const peers = this.hmsStore.getState(mod.selectPeers) as HMSPeer[];
    const remote = peers.find((p) => !p.isLocal);
    if (remote?.videoTrack) this.tryAttachRemote(remote.videoTrack);
  }

  private async tryAttachLocal(trackId: string) {
    if (!this.actions || !this.localVideoEl) return;
    if (this.attachedLocalTrackId === trackId) return;
    try {
      await this.actions.attachVideo(trackId, this.localVideoEl);
      this.attachedLocalTrackId = trackId;
    } catch { /* ignore */ }
  }

  private async tryAttachRemote(trackId: string) {
    if (!this.actions || !this.remoteVideoEl) return;
    if (this.attachedRemoteTrackId === trackId) return;
    try {
      await this.actions.attachVideo(trackId, this.remoteVideoEl);
      this.attachedRemoteTrackId = trackId;
    } catch { /* ignore */ }
  }

  async setMicEnabled(on: boolean) {
    await this.actions?.setLocalAudioEnabled(on);
  }

  async setCamEnabled(on: boolean) {
    if (this.kind !== "video") return;
    await this.actions?.setLocalVideoEnabled(on);
  }

  async leave() {
    for (const u of this.unsubscribes) {
      try { u(); } catch { /* ignore */ }
    }
    this.unsubscribes = [];
    try { await this.actions?.leave(); } catch { /* ignore */ }
    this.actions = null;
    this.hmsStore = null;
    this.store = null;
  }

  stats() {
    return {
      channel: this.channel,
      qualityAvg: this.qualityCount > 0 ? this.qualitySum / this.qualityCount : 0,
      disconnects: this.disconnects,
    };
  }
}
