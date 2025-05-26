import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Upload, Volume2, Plus, Download, Trash2, Clock, FileText, Maximize2, Minimize2, ChevronLeft, ChevronRight, Pencil, Check } from 'lucide-react';
import './App.css';

const AdvancedSlideshow = () => {
  const [audioFile, setAudioFile] = useState(null);
  const [images, setImages] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [slides, setSlides] = useState([]);
  const [srtFile, setSrtFile] = useState(null);
  const [timingMode, setTimingMode] = useState('manual');
  const [autoShiftEnabled, setAutoShiftEnabled] = useState(true);
  const [previewChanges, setPreviewChanges] = useState(null);
  const [editingSlideId, setEditingSlideId] = useState(null);
  
  const hideTimeoutRef = useRef(null);
  const audioRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const srtInputRef = useRef(null);
  const slideshowRef = useRef(null);

  // Handle audio file upload
  const handleAudioUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('audio/')) {
      const url = URL.createObjectURL(file);
      setAudioFile(url);
      setCurrentTime(0);
      setCurrentSlide(0);
      setIsPlaying(false);
    }
    event.target.value = '';
  };

  // Handle image files upload
  const handleImagesUpload = (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    const imageUrls = [];
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        imageUrls.push({ url, name: file.name });
      }
    });
    
    setImages(imageUrls);
    setCurrentSlide(0);
    
    // If no slides yet, create default slides
    if (slides.length === 0 && timingMode === 'manual') {
      createDefaultSlides(imageUrls.length);
    }
    
    event.target.value = '';
  };

  // Handle SRT file upload
  const handleSRTUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.name.endsWith('.srt')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const srtText = e.target.result;
        const parsedSlides = parseSRT(srtText);
        
        if (parsedSlides.length > 0) {
          setSlides(parsedSlides);
          setSrtFile(file.name);
          setTimingMode('srt');
          setCurrentSlide(0);
        } else {
          alert('Could not parse SRT file. Please check the format.');
        }
      };
      reader.readAsText(file);
    } else {
      alert('Please select a valid .srt file');
    }
    event.target.value = '';
  };

  // Create default manual slides
  const createDefaultSlides = (imageCount) => {
    const defaultSlides = [];
    for (let i = 0; i < imageCount; i++) {
      defaultSlides.push({
        id: Date.now() + i,
        text: `Slide ${i + 1}`,
        startTime: i * 10,
        endTime: (i + 1) * 10,
        imageIndex: i
      });
    }
    setSlides(defaultSlides);
  };

  // Parse SRT file
  const parseSRT = (srtText) => {
    const blocks = srtText.trim().split('\n\n');
    const parsedSlides = [];

    blocks.forEach((block, index) => {
      const lines = block.split('\n');
      if (lines.length >= 3) {
        const timeLine = lines[1];
        const textLines = lines.slice(2);
        
        const timeMatch = timeLine.match(/^(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})$/);
        
        if (timeMatch) {
          const [, startH, startM, startS, startMs, endH, endM, endS, endMs] = timeMatch;
          
          const startTime = parseInt(startH) * 3600 + parseInt(startM) * 60 + parseInt(startS) + parseInt(startMs) / 1000;
          const endTime = parseInt(endH) * 3600 + parseInt(endM) * 60 + parseInt(endS) + parseInt(endMs) / 1000;
          
          const text = textLines.join('\n').trim();
          
          parsedSlides.push({
            id: Date.now() + index,
            text: text,
            startTime: startTime,
            endTime: endTime,
            imageIndex: Math.min(index, images.length - 1)
          });
        }
      }
    });

    return parsedSlides;
  };

  // Audio event handlers
  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handlePlayPause = async () => {
    if (audioRef.current) {
      try {
        if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
        } else {
          await audioRef.current.play();
          setIsPlaying(true);
        }
      } catch (error) {
        console.error('Play error:', error);
        setIsPlaying(false);
      }
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  const handleSeek = (e) => {
    if (audioRef.current && duration > 0) {
      const seekTime = (e.target.value / 100) * duration;
      audioRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
  };

  // Format seconds to display string
  const formatSeconds = (seconds) => {
    return `${seconds.toFixed(1)}s`;
  };

  // Auto-shift logic
  const autoShiftSubsequentSlides = (changedSlideId, newEndTime, oldEndTime) => {
    const timeDifference = newEndTime - oldEndTime;
    const changedSlideIndex = slides.findIndex(slide => slide.id === changedSlideId);
    
    // Validasi minimum gap
    const MIN_GAP = 0.1;
    const nextSlide = slides[changedSlideIndex + 1];
    if (nextSlide && (newEndTime + MIN_GAP) > nextSlide.startTime) {
      return null; // Invalid timing
    }

    const updatedSlides = slides.map((slide, index) => {
      if (index > changedSlideIndex) {
        const newStartTime = slide.startTime + timeDifference;
        const newEndTime = slide.endTime + timeDifference;
        
        // Validasi minimum duration
        if (newEndTime - newStartTime < MIN_GAP) {
          return null; // Invalid timing
        }
        
        return {
          ...slide,
          startTime: newStartTime,
          endTime: newEndTime
        };
      }
      return slide;
    });

    // Filter out any null values (invalid timings)
    return updatedSlides.filter(slide => slide !== null);
  };

  // Update slide time with seconds
  const updateSlideTime = (slideId, field, value) => {
    setSlides(prevSlides => {
      const currentSlide = prevSlides.find(slide => slide.id === slideId);
      if (!currentSlide) return prevSlides;

      // Handle text update
      if (field === 'text') {
        return prevSlides.map(slide => 
          slide.id === slideId ? { ...slide, text: value } : slide
        );
      }

      // Handle time updates
      const seconds = parseFloat(value);
      if (isNaN(seconds) || seconds < 0) return prevSlides;

      if (field === 'endTime' && autoShiftEnabled) {
        const shiftedSlides = autoShiftSubsequentSlides(slideId, seconds, currentSlide.endTime);
        if (shiftedSlides) {
          setPreviewChanges({
            changedSlideId: slideId,
            newEndTime: seconds,
            affectedSlides: shiftedSlides.filter((s, i) => i > prevSlides.findIndex(slide => slide.id === slideId))
          });
          
          return prevSlides.map(slide => {
            if (slide.id === slideId) {
              return { ...slide, endTime: seconds };
            }
            const shiftedSlide = shiftedSlides.find(s => s.id === slide.id);
            return shiftedSlide || slide;
          });
        }
        return prevSlides;
      }

      return prevSlides.map(slide => 
        slide.id === slideId ? { ...slide, [field]: seconds } : slide
      );
    });
  };

  // Quick time adjustment
  const adjustTime = (slideId, field, adjustment) => {
    setSlides(prevSlides => {
      const updatedSlides = prevSlides.map(slide => {
        if (slide.id === slideId) {
          const newTime = slide[field] + adjustment;
          if (newTime < 0) return slide;
          
          if (autoShiftEnabled && field === 'endTime') {
            const shiftedSlides = autoShiftSubsequentSlides(slideId, newTime, slide.endTime);
            if (shiftedSlides) {
              setPreviewChanges({
                changedSlideId: slideId,
                newEndTime: newTime,
                affectedSlides: shiftedSlides.filter((s, i) => i > prevSlides.findIndex(slide => slide.id === slideId))
              });
              return { ...slide, [field]: newTime };
            }
            return slide;
          }
          
          return { ...slide, [field]: newTime };
        }
        return slide;
      });

      // Apply auto-shift changes if preview exists
      if (previewChanges && previewChanges.changedSlideId === slideId) {
        return updatedSlides.map(slide => {
          const affectedSlide = previewChanges.affectedSlides.find(s => s.id === slide.id);
          return affectedSlide || slide;
        });
      }

      return updatedSlides;
    });
  };

  // Apply preview changes
  const applyPreviewChanges = () => {
    if (previewChanges) {
      setSlides(prevSlides => 
        prevSlides.map(slide => {
          const affectedSlide = previewChanges.affectedSlides.find(s => s.id === slide.id);
          return affectedSlide || slide;
        })
      );
      setPreviewChanges(null);
    }
  };

  // Cancel preview changes
  const cancelPreviewChanges = () => {
    setPreviewChanges(null);
  };

  // Auto-hide controls handler
  const handleMouseMove = () => {
    setControlsVisible(true);
    
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    
    hideTimeoutRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, 2000);
  };

  const handleMouseLeave = () => {
    setControlsVisible(false);
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  // Reset controls visibility when exiting fullscreen
  useEffect(() => {
    if (!isFullscreen) {
      setControlsVisible(true);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    }
  }, [isFullscreen]);

  // Fullscreen handlers
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      try {
        await slideshowRef.current.requestFullscreen();
        setIsFullscreen(true);
      } catch (err) {
        console.error('Error attempting to enable fullscreen:', err);
      }
    } else {
      try {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } catch (err) {
        console.error('Error attempting to exit fullscreen:', err);
      }
    }
  };

  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Handle ESC key
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && isFullscreen) {
        document.exitFullscreen();
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isFullscreen]);

  // Navigation handlers
  const goToNextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const goToPreviousSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  // Update slide berdasarkan timing
  useEffect(() => {
    if (slides.length > 0 && currentTime > 0) {
      let activeSlide = 0;
      for (let i = slides.length - 1; i >= 0; i--) {
        if (currentTime >= slides[i].startTime) {
          activeSlide = i;
          break;
        }
      }
      
      if (activeSlide !== currentSlide) {
        setCurrentSlide(activeSlide);
      }
    }
  }, [currentTime, slides, currentSlide]);

  // Add slide at current time
  const addSlideAtCurrentTime = () => {
    const newSlide = {
      id: Date.now(),
      text: `Slide ${slides.length + 1}`,
      startTime: currentTime,
      endTime: currentTime + 10,
      imageIndex: Math.min(slides.length, images.length - 1)
    };
    
    const updatedSlides = [...slides, newSlide].sort((a, b) => a.startTime - b.startTime);
    setSlides(updatedSlides);
    setTimingMode('manual');
  };

  // Delete slide
  const deleteSlide = (slideId) => {
    setSlides(slides.filter(slide => slide.id !== slideId));
  };

  // Export current timing as SRT
  const exportToSRT = () => {
    let srtContent = '';
    slides.forEach((slide, index) => {
      const startTime = formatSRTTime(slide.startTime);
      const endTime = formatSRTTime(slide.endTime);
      
      srtContent += `${index + 1}\n`;
      srtContent += `${startTime} --> ${endTime}\n`;
      srtContent += `${slide.text}\n\n`;
    });
    
    const blob = new Blob([srtContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'slideshow-timing.srt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Format time for SRT export
  const formatSRTTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  };

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`app-container ${isFullscreen ? 'fullscreen' : ''}`}>
      <div className="app-content">
        {!isFullscreen && (
          <>
            <h1 className="app-title">
              Advanced Slideshow with Custom Timing
            </h1>
            
            {/* Upload Section */}
            <div className="upload-section">
              <div className="upload-grid">
                <div>
                  <label className="upload-label">
                    Upload Audio File
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleAudioUpload}
                    className="hidden-input"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="upload-button audio-button"
                  >
                    <Upload size={20} />
                    Choose Audio
                  </button>
                </div>
                
                <div>
                  <label className="upload-label">
                    Upload Images
                  </label>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImagesUpload}
                    className="hidden-input"
                  />
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    className="upload-button image-button"
                  >
                    <Upload size={20} />
                    Images ({images.length})
                  </button>
                </div>

                <div>
                  <label className="upload-label">
                    Upload SRT File (Optional)
                  </label>
                  <input
                    ref={srtInputRef}
                    type="file"
                    accept=".srt"
                    onChange={handleSRTUpload}
                    className="hidden-input"
                  />
                  <button
                    onClick={() => srtInputRef.current?.click()}
                    className="upload-button srt-button"
                  >
                    <FileText size={20} />
                    SRT Timing
                  </button>
                </div>
              </div>

              {/* Timing Mode Indicator */}
              <div className="timing-mode">
                <div className={`mode-indicator ${timingMode === 'manual' ? 'active' : ''}`}>
                  Manual Timing
                </div>
                <div className={`mode-indicator ${timingMode === 'srt' ? 'active' : ''}`}>
                  SRT Timing {srtFile && `(${srtFile})`}
                </div>
              </div>
            </div>
          </>
        )}

        <div className={`main-grid ${isFullscreen ? 'fullscreen-grid' : ''}`}>
          {/* Slideshow Display */}
          <div 
            className={`slideshow-container ${isFullscreen ? 'fullscreen-slideshow' : ''}`}
            style={{ cursor: controlsVisible ? 'default' : 'none' }}
            ref={slideshowRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <div className="slideshow-display">
              {images.length > 0 && slides.length > 0 ? (
                <div className="slide-content" key={currentSlide}>
                  <img
                    src={images[slides[currentSlide]?.imageIndex || 0]?.url}
                    alt={`Slide ${currentSlide + 1}`}
                    className={`slide-image ${isFullscreen ? 'fullscreen-image' : ''}`}
                  />
                  <div className="slide-text-container">
                    <p className="slide-text">
                      {slides[currentSlide]?.text || ''}
                    </p>
                  </div>
                  <div className={`slide-counter ${controlsVisible ? 'show' : 'hide'}`}>
                    {currentSlide + 1} / {slides.length}
                  </div>
                  <div className={`time-counter ${controlsVisible ? 'show' : 'hide'}`}>
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </div>
                  
                  {/* Fullscreen Controls */}
                  <button
                    onClick={toggleFullscreen}
                    className={`fullscreen-button ${controlsVisible ? 'show' : 'hide'}`}
                    title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                  >
                    {isFullscreen ? <Minimize2 size={24} /> : <Maximize2 size={24} />}
                  </button>

                  {/* Navigation Controls */}
                  {isFullscreen && (
                    <>
                      <button
                        onClick={goToPreviousSlide}
                        className={`nav-button prev-button ${controlsVisible ? 'show' : 'hide'}`}
                        disabled={currentSlide === 0}
                      >
                        <ChevronLeft size={32} />
                      </button>
                      <button
                        onClick={goToNextSlide}
                        className={`nav-button next-button ${controlsVisible ? 'show' : 'hide'}`}
                        disabled={currentSlide === slides.length - 1}
                      >
                        <ChevronRight size={32} />
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="empty-slideshow">
                  <div className="empty-content">
                    <Upload size={48} className="empty-icon" />
                    <p>Upload audio, images, and set timing</p>
                  </div>
                </div>
              )}
            </div>

            {/* Audio Controls */}
            {audioFile && (
              <div className={`audio-controls ${isFullscreen ? 'fullscreen-audio-controls' : ''} ${controlsVisible ? 'show' : 'hide'}`}>
                <audio
                  ref={audioRef}
                  src={audioFile}
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={() => setIsPlaying(false)}
                  className="hidden-audio"
                />
                
                <div className="audio-controls-grid">
                  <button
                    onClick={handlePlayPause}
                    className="play-button"
                  >
                    {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                  </button>
                  
                  <div className="seek-container">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={duration ? (currentTime / duration) * 100 : 0}
                      onChange={handleSeek}
                      className="seek-slider"
                    />
                  </div>
                  
                  <div className="volume-control">
                    <Volume2 size={20} className="volume-icon" />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={volume}
                      onChange={handleVolumeChange}
                      className="volume-slider"
                    />
                  </div>
                </div>
                
                {!isFullscreen && (
                  <button
                    onClick={addSlideAtCurrentTime}
                    disabled={!audioFile}
                    className="add-slide-button"
                  >
                    <Plus size={16} />
                    Add Slide at {formatTime(currentTime)}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Timing Editor */}
          {!isFullscreen && (
            <div className="timing-editor">
              <div className="editor-header">
                <div className="editor-title-section">
                <h3 className="editor-title">Timing Editor</h3>
                  <div className="auto-shift-toggle">
                    <label className="toggle-label">
                      <input
                        type="checkbox"
                        checked={autoShiftEnabled}
                        onChange={(e) => setAutoShiftEnabled(e.target.checked)}
                      />
                      <span className="toggle-text">Auto-Shift</span>
                      <span className={`toggle-status ${autoShiftEnabled ? 'enabled' : 'disabled'}`}>
                        {autoShiftEnabled ? 'ON' : 'OFF'}
                      </span>
                    </label>
                  </div>
                </div>
                <div className="editor-actions">
                  <button
                    onClick={() => setSlides([])}
                    disabled={slides.length === 0}
                    className="clear-button"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={exportToSRT}
                    disabled={slides.length === 0}
                    className="export-button"
                  >
                    <Download size={14} />
                    Export SRT
                  </button>
                </div>
              </div>

              {/* Preview Changes Panel */}
              {previewChanges && (
                <div className="preview-panel">
                  <div className="preview-header">
                    <span className="preview-warning">
                      Will shift {previewChanges.affectedSlides.length} slides
                    </span>
                    <div className="preview-actions">
                      <button onClick={applyPreviewChanges} className="apply-button">
                        Apply Changes
                      </button>
                      <button onClick={cancelPreviewChanges} className="cancel-button">
                        Cancel
                      </button>
                    </div>
                  </div>
                  <div className="preview-timeline">
                    {previewChanges.affectedSlides.slice(0, 3).map((slide, index) => (
                      <div key={slide.id} className="preview-item">
                        <span className="preview-text">{slide.text}</span>
                        <span className="preview-time">
                          {formatSeconds(slide.startTime)} → {formatSeconds(slide.endTime)}
                        </span>
                      </div>
                    ))}
                    {previewChanges.affectedSlides.length > 3 && (
                      <div className="preview-more">
                        +{previewChanges.affectedSlides.length - 3} more slides
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Slides Timeline */}
              <div className="slides-timeline">
                {slides.map((slide, index) => (
                  <div
                    key={slide.id}
                    className={`slide-item ${index === currentSlide ? 'active' : ''} ${editingSlideId === slide.id ? 'editing' : ''}`}
                  >
                    <div className="slide-grid">
                      <div className="slide-text-input">
                        <textarea
                          value={slide.text}
                          onChange={(e) => updateSlideTime(slide.id, 'text', e.target.value)}
                          className="timing-input text-input"
                          placeholder="Slide text"
                          rows={2}
                        />
                      </div>
                      <div className="slide-time-display">
                        {editingSlideId === slide.id ? (
                          <div className="time-editor">
                            <div className="time-inputs">
                              <div className="time-input-group">
                                <label>Start</label>
                        <input
                                  type="number"
                                  value={slide.startTime}
                          onChange={(e) => updateSlideTime(slide.id, 'startTime', e.target.value)}
                                  step="0.1"
                                  min="0"
                          className="timing-input"
                                />
                                <div className="quick-adjust">
                                  <button onClick={() => adjustTime(slide.id, 'startTime', -1)}>-1s</button>
                                  <button onClick={() => adjustTime(slide.id, 'startTime', -0.5)}>-0.5s</button>
                                  <button onClick={() => adjustTime(slide.id, 'startTime', 0.5)}>+0.5s</button>
                                  <button onClick={() => adjustTime(slide.id, 'startTime', 1)}>+1s</button>
                                </div>
                      </div>
                              <div className="time-input-group">
                                <label>End</label>
                        <input
                                  type="number"
                                  value={slide.endTime}
                          onChange={(e) => updateSlideTime(slide.id, 'endTime', e.target.value)}
                                  step="0.1"
                                  min="0"
                                  className={`timing-input ${autoShiftEnabled ? 'auto-shift-enabled' : ''}`}
                                />
                                <div className="quick-adjust">
                                  <button onClick={() => adjustTime(slide.id, 'endTime', -1)}>-1s</button>
                                  <button onClick={() => adjustTime(slide.id, 'endTime', -0.5)}>-0.5s</button>
                                  <button onClick={() => adjustTime(slide.id, 'endTime', 0.5)}>+0.5s</button>
                                  <button onClick={() => adjustTime(slide.id, 'endTime', 1)}>+1s</button>
                                </div>
                              </div>
                            </div>
                            <div className="timeline-bar">
                              <div className="timeline-progress" style={{
                                left: `${(slide.startTime / duration) * 100}%`,
                                width: `${((slide.endTime - slide.startTime) / duration) * 100}%`
                              }} />
                            </div>
                          </div>
                        ) : (
                          <div className="time-display">
                            <span>{formatSeconds(slide.startTime)} → {formatSeconds(slide.endTime)}</span>
                            <button
                              onClick={() => setEditingSlideId(slide.id)}
                              className="edit-button"
                            >
                              <Pencil size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="slide-actions">
                        {editingSlideId === slide.id ? (
                          <button
                            onClick={() => setEditingSlideId(null)}
                            className="check-button"
                          >
                            <Check size={14} />
                          </button>
                        ) : (
                        <button
                          onClick={() => deleteSlide(slide.id)}
                          className="delete-button"
                        >
                          <Trash2 size={14} />
                        </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {slides.length === 0 && (
                  <div className="empty-timeline">
                    <Clock size={32} className="empty-icon" />
                    <p>No slides added yet</p>
                    <p className="empty-subtext">Upload images and add timing, or use SRT file</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Instructions - Hidden in fullscreen */}
        {!isFullscreen && (
          <div className="instructions-section">
            <div className="instructions-grid">
              <div>
                <h3 className="instructions-title">Manual Timing:</h3>
                <ol className="instructions-list">
                  <li>Upload audio and images</li>
                  <li>Play audio and click "Add Slide at [time]" for each slide</li>
                  <li>Edit slide text and timing in the editor</li>
                  <li>Export to SRT if needed</li>
                </ol>
              </div>
              <div>
                <h3 className="instructions-title">SRT File Method:</h3>
                <ol className="instructions-list">
                  <li>Create or download SRT subtitle file</li>
                  <li>Upload audio and images</li>
                  <li>Upload SRT file - timing will be applied automatically</li>
                  <li>Fine-tune timing if needed</li>
                </ol>
              </div>
            </div>
            
            <div className="srt-example">
              <h4 className="example-title">SRT Format Example:</h4>
              <pre className="example-code">
{`1
00:00:00,500 --> 00:00:04,000
First slide text

2
00:00:04,000 --> 00:00:08,500
Second slide text`}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdvancedSlideshow;