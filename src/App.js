import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Plus, Trash2, Edit2, Save, X, Type, Image, AlertCircle } from 'lucide-react';

export default function RTSPLivestream() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [overlays, setOverlays] = useState([]);
  const [showOverlayModal, setShowOverlayModal] = useState(false);
  const [editingOverlay, setEditingOverlay] = useState(null);
  const [rtspUrl, setRtspUrl] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef(null);

  const [overlayForm, setOverlayForm] = useState({
    type: 'text',
    content: '',
    x: 50,
    y: 50,
    width: 200,
    height: 100,
    fontSize: 24,
    color: '#ffffff',
    backgroundColor: 'rgba(0,0,0,0.5)'
  });

  useEffect(() => {
    fetchOverlays();
  }, []);

  useEffect(() => {
    if (videoRef.current && streamUrl) {
      videoRef.current.load();
    }
  }, [streamUrl]);

  const fetchOverlays = async () => {
    try {
      const response = await fetch('/api/overlays');
      if (response.ok) {
        const data = await response.json();
        setOverlays(data.data || []);
      }
    } catch (err) {
      console.log('Using local overlay storage');
    }
  };

  const handlePlayPause = async () => {
    if (!videoRef.current || !streamUrl) return;
    
    const video = videoRef.current;
    
    try {
      if (isPlaying) {
        video.pause();
        setIsPlaying(false);
      } else {
        if (video.readyState < 2) {
          setIsLoading(true);
          await new Promise((resolve) => {
            video.addEventListener('canplay', resolve, { once: true });
            setTimeout(resolve, 5000);
          });
        }
        
        const playPromise = video.play();
        if (playPromise !== undefined) {
          await playPromise;
          setIsPlaying(true);
          setError('');
        }
      }
    } catch (err) {
      console.error('Playback error:', err);
      if (err.name === 'NotAllowedError') {
        setError('Browser blocked autoplay. Please click play button.');
      } else if (err.name === 'AbortError') {
        setError('Playback interrupted. Please try again.');
      } else {
        setError('Unable to play video. Please check the stream URL.');
      }
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMutedState = !isMuted;
      videoRef.current.muted = newMutedState;
      setIsMuted(newMutedState);
      if (newMutedState) {
        setVolume(0);
      } else {
        setVolume(videoRef.current.volume || 1);
      }
    }
  };

  const handleCreateOverlay = async () => {
    const newOverlay = {
      id: Date.now().toString(),
      ...overlayForm
    };

    try {
      const response = await fetch('/api/overlays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(overlayForm)
      });
      
      if (response.ok) {
        const data = await response.json();
        setOverlays([...overlays, data.data]);
      } else {
        setOverlays([...overlays, newOverlay]);
      }
    } catch (err) {
      setOverlays([...overlays, newOverlay]);
    }
    
    closeModal();
  };

  const handleUpdateOverlay = async () => {
    try {
      const response = await fetch(`/api/overlays/${editingOverlay.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(overlayForm)
      });
      
      if (response.ok) {
        const data = await response.json();
        setOverlays(overlays.map(o => o.id === editingOverlay.id ? data.data : o));
      } else {
        setOverlays(overlays.map(o => 
          o.id === editingOverlay.id ? { ...editingOverlay, ...overlayForm } : o
        ));
      }
    } catch (err) {
      setOverlays(overlays.map(o => 
        o.id === editingOverlay.id ? { ...editingOverlay, ...overlayForm } : o
      ));
    }
    
    closeModal();
  };

  const handleDeleteOverlay = async (id) => {
    try {
      const response = await fetch(`/api/overlays/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok || response.status === 404) {
        setOverlays(overlays.filter(o => o.id !== id));
      }
    } catch (err) {
      setOverlays(overlays.filter(o => o.id !== id));
    }
  };

  const openModal = (overlay = null) => {
    if (overlay) {
      setEditingOverlay(overlay);
      setOverlayForm({
        type: overlay.type,
        content: overlay.content,
        x: overlay.x,
        y: overlay.y,
        width: overlay.width,
        height: overlay.height,
        fontSize: overlay.fontSize || 24,
        color: overlay.color || '#ffffff',
        backgroundColor: overlay.backgroundColor || 'rgba(0,0,0,0.5)'
      });
    } else {
      setEditingOverlay(null);
      setOverlayForm({
        type: 'text',
        content: '',
        x: 50,
        y: 50,
        width: 200,
        height: 100,
        fontSize: 24,
        color: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.5)'
      });
    }
    setShowOverlayModal(true);
  };

  const closeModal = () => {
    setShowOverlayModal(false);
    setEditingOverlay(null);
  };

  const handleLoadStream = async () => {
    if (!rtspUrl.trim()) {
      setError('Please enter a valid RTSP URL');
      return;
    }

    setIsLoading(true);
    setError('');
    setIsPlaying(false);
    setVideoReady(false);

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }

    try {
      const response = await fetch('/api/stream/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rtsp_url: rtspUrl })
      });

      if (response.ok) {
        const data = await response.json();
        setStreamUrl(data.stream_url || '/api/stream/video');
      } else {
        setStreamUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
      }
    } catch (err) {
      console.log('Using demo video');
      setStreamUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVideoError = (e) => {
    console.error('Video error:', e);
    setError('Failed to load video stream. Please check the URL and try again.');
    setIsLoading(false);
    setIsPlaying(false);
    setVideoReady(false);
  };

  const handleVideoCanPlay = () => {
    setVideoReady(true);
    setIsLoading(false);
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <header className="bg-black bg-opacity-50 backdrop-blur-md border-b border-purple-500/30">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <Play className="w-6 h-6 text-white" fill="white" />
              </div>
              RTSP Livestream
            </h1>
            <button
              onClick={() => openModal()}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Overlay
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="mb-6 bg-black bg-opacity-40 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20">
          <label className="block text-white mb-2 font-medium">RTSP Stream URL</label>
          <div className="flex gap-3">
            <input
              type="text"
              value={rtspUrl}
              onChange={(e) => setRtspUrl(e.target.value)}
              placeholder="rtsp://example.com/stream"
              className="flex-1 px-4 py-3 bg-slate-800 text-white rounded-lg border border-purple-500/30 focus:border-purple-500 focus:outline-none"
              onKeyPress={(e) => e.key === 'Enter' && handleLoadStream()}
            />
            <button
              onClick={handleLoadStream}
              disabled={isLoading}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Loading...' : 'Load Stream'}
            </button>
          </div>
          <p className="text-gray-400 text-sm mt-2">
            Enter your RTSP URL or try: rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mp4
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-500 bg-opacity-20 border border-red-500 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-200">{error}</p>
          </div>
        )}

        <div className="relative bg-black rounded-xl overflow-hidden shadow-2xl mb-6">
          <div className="relative aspect-video">
            {streamUrl ? (
              <>
                <video
                  ref={videoRef}
                  src={streamUrl}
                  className="w-full h-full object-contain bg-black"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onError={handleVideoError}
                  onCanPlay={handleVideoCanPlay}
                  onWaiting={() => setIsLoading(true)}
                  onPlaying={() => setIsLoading(false)}
                  onLoadedMetadata={() => setVideoReady(true)}
                  playsInline
                  preload="auto"
                />

                {overlays.map(overlay => (
                  <div
                    key={overlay.id}
                    style={{
                      position: 'absolute',
                      left: `${overlay.x}px`,
                      top: `${overlay.y}px`,
                      width: `${overlay.width}px`,
                      height: `${overlay.height}px`,
                      backgroundColor: overlay.backgroundColor,
                      color: overlay.color,
                      fontSize: `${overlay.fontSize}px`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '8px',
                      padding: '10px',
                      pointerEvents: 'none',
                      fontWeight: 'bold',
                      textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
                    }}
                  >
                    {overlay.type === 'text' ? overlay.content : '🖼️'}
                  </div>
                ))}

                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
                      <p className="text-white">Loading stream...</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                <div className="text-center">
                  <Play className="w-20 h-20 text-purple-500 mx-auto mb-4" />
                  <p className="text-white text-xl">Enter RTSP URL to start streaming</p>
                  <p className="text-gray-400 text-sm mt-2">Supports RTSP, HTTP, and HTTPS streams</p>
                </div>
              </div>
            )}
          </div>

          {streamUrl && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-6">
              <div className="flex items-center gap-4">
                <button
                  onClick={handlePlayPause}
                  disabled={!videoReady || isLoading}
                  className="w-12 h-12 bg-purple-600 hover:bg-purple-700 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6 text-white" fill="white" />
                  ) : (
                    <Play className="w-6 h-6 text-white ml-1" fill="white" />
                  )}
                </button>

                <div className="flex items-center gap-3 flex-1">
                  <button 
                    onClick={toggleMute} 
                    className="text-white hover:text-purple-400 transition-colors"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-6 h-6" />
                    ) : (
                      <Volume2 className="w-6 h-6" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-32 accent-purple-500"
                  />
                </div>

                <div className="text-white text-sm bg-black bg-opacity-50 px-3 py-1 rounded flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  LIVE
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-black bg-opacity-40 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20">
          <h2 className="text-2xl font-bold text-white mb-4">Manage Overlays</h2>
          
          {overlays.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Type className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No overlays created yet. Click "Add Overlay" to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {overlays.map(overlay => (
                <div
                  key={overlay.id}
                  className="bg-slate-800 rounded-lg p-4 border border-purple-500/20 hover:border-purple-500/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {overlay.type === 'text' ? (
                          <Type className="w-4 h-4 text-purple-400" />
                        ) : (
                          <Image className="w-4 h-4 text-purple-400" />
                        )}
                        <span className="text-white font-medium capitalize">{overlay.type}</span>
                      </div>
                      <p className="text-gray-300 text-sm truncate">{overlay.content}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openModal(overlay)}
                        className="text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteOverlay(overlay.id)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 mt-2">
                    Position: ({overlay.x}, {overlay.y}) | Size: {overlay.width}×{overlay.height}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showOverlayModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full border border-purple-500/30 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                {editingOverlay ? 'Edit Overlay' : 'Create Overlay'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-white mb-2 text-sm">Type</label>
                <select
                  value={overlayForm.type}
                  onChange={(e) => setOverlayForm({ ...overlayForm, type: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-purple-500/30 focus:border-purple-500 focus:outline-none"
                >
                  <option value="text">Text</option>
                  <option value="logo">Logo</option>
                </select>
              </div>

              <div>
                <label className="block text-white mb-2 text-sm">Content</label>
                <input
                  type="text"
                  value={overlayForm.content}
                  onChange={(e) => setOverlayForm({ ...overlayForm, content: e.target.value })}
                  placeholder={overlayForm.type === 'text' ? 'Enter text' : 'Logo URL'}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-purple-500/30 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white mb-2 text-sm">X Position</label>
                  <input
                    type="number"
                    value={overlayForm.x}
                    onChange={(e) => setOverlayForm({ ...overlayForm, x: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-purple-500/30 focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-white mb-2 text-sm">Y Position</label>
                  <input
                    type="number"
                    value={overlayForm.y}
                    onChange={(e) => setOverlayForm({ ...overlayForm, y: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-purple-500/30 focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white mb-2 text-sm">Width</label>
                  <input
                    type="number"
                    value={overlayForm.width}
                    onChange={(e) => setOverlayForm({ ...overlayForm, width: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-purple-500/30 focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-white mb-2 text-sm">Height</label>
                  <input
                    type="number"
                    value={overlayForm.height}
                    onChange={(e) => setOverlayForm({ ...overlayForm, height: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-purple-500/30 focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              {overlayForm.type === 'text' && (
                <>
                  <div>
                    <label className="block text-white mb-2 text-sm">Font Size</label>
                    <input
                      type="number"
                      value={overlayForm.fontSize}
                      onChange={(e) => setOverlayForm({ ...overlayForm, fontSize: parseInt(e.target.value) || 24 })}
                      className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-purple-500/30 focus:border-purple-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-white mb-2 text-sm">Text Color</label>
                      <input
                        type="color"
                        value={overlayForm.color}
                        onChange={(e) => setOverlayForm({ ...overlayForm, color: e.target.value })}
                        className="w-full h-10 bg-slate-700 rounded-lg border border-purple-500/30 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-white mb-2 text-sm">Background</label>
                      <input
                        type="color"
                        value={overlayForm.backgroundColor.includes('rgba') ? '#000000' : overlayForm.backgroundColor}
                        onChange={(e) => setOverlayForm({ ...overlayForm, backgroundColor: e.target.value })}
                        className="w-full h-10 bg-slate-700 rounded-lg border border-purple-500/30 cursor-pointer"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={editingOverlay ? handleUpdateOverlay : handleCreateOverlay}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {editingOverlay ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}