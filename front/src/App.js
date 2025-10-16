import React, { useState, useRef, useEffect } from 'react';
import './App.css'

const API_ENDPOINT = `${process.env.REACT_APP_API_URL}/upload`;

const AUTO_DETECT_INTERVAL_MS = 500;

function SimpleImageUploader() {
    const [capturedBlob, setCapturedBlob] = useState(null); 
    const [status, setStatus] = useState('พร้อมใช้งาน'); 
    const [isCameraActive, setIsCameraActive] = useState(false); 
    const [isAutoDetecting, setIsAutoDetecting] = useState(false);
    const [predictionMessage, setPredictionMessage] = useState(null); 
    const [predictedImageBase64, setPredictedImageBase64] = useState(null); 
    const [isSending, setIsSending] = useState(false); 
    const [modelName, setModelName] = useState('new'); 
    
    const videoRef = useRef(null); 
    const canvasRef = useRef(null); 
    const streamRef = useRef(null); 
    const autoDetectIntervalRef = useRef(null);

    const stopCamera = () => {
        stopAutoDetect(); 
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setIsCameraActive(false);
    };

    const startCamera = async () => {
        stopCamera();
        setCapturedBlob(null); 
        setPredictionMessage(null); 
        setPredictedImageBase64(null); 
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: ["environment", "user", "left", "right"] } }, audio: false });
            streamRef.current = stream;
            
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            setIsCameraActive(true);
            setStatus('กล้องเปิดแล้ว 📷');
        } catch (err) {
            setStatus(`เข้าถึงกล้องไม่ได้: ${err.message}`);
        }
    };
    
    const stopAutoDetect = () => {
        if (autoDetectIntervalRef.current) {
            clearInterval(autoDetectIntervalRef.current);
            autoDetectIntervalRef.current = null;
        }
        setPredictedImageBase64(null)
        setIsAutoDetecting(false);
        if (isCameraActive) {
             setStatus('หยุดการทำนายอัตโนมัติ 🛑');
        }
    };

    const startAutoDetect = () => {
        if (!isCameraActive) {
            setStatus('กรุณาเปิดกล้องก่อนเริ่ม Auto Detect');
            return;
        }
        stopAutoDetect(); 
        setIsAutoDetecting(true);
        setStatus(`เริ่มทำนายอัตโนมัติ (${1000 / AUTO_DETECT_INTERVAL_MS} FPS) 🚀`);

        // ตั้ง Interval เพื่อถ่ายภาพและส่งทำนายซ้ำๆ
        autoDetectIntervalRef.current = setInterval(() => {
            takeAndSendPhoto(true);
        }, AUTO_DETECT_INTERVAL_MS);
    };

    const takeAndSendPhoto = async (isAuto = false, fileToUpload = null) => {
        let file;

        // 1. จัดการการถ่ายภาพ/เตรียมไฟล์
        if (fileToUpload) {
            file = fileToUpload;
        } else if (isAuto || isCameraActive) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            
            if (!video || !canvas || isSending) {
                // ป้องกันการถ่ายภาพซ้อนทับกันขณะที่กำลังส่งข้อมูลอยู่
                return;
            }
            
            // ถ่ายภาพจาก Video ลง Canvas
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // แปลงภาพใน Canvas เป็นไฟล์ (Blob/File)
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
            file = new File([blob], "captured_image.jpeg", { type: "image/jpeg" });
            
            // ในโหมด Manual, เซ็ต capturedBlob และหยุดกล้อง
            if (!isAuto) {
                setCapturedBlob(file);
                stopCamera();
                setStatus('ถ่ายภาพสำเร็จ! กำลังส่งทำนาย...');
            }

        } else if (capturedBlob) {
            file = capturedBlob;
        } else {
            return;
        }

        setIsSending(true);
        if (!isAuto) {
             setPredictionMessage(null);
        }
       
        const formData = new FormData();
        formData.append('file', file, file.name); 
        formData.append('model', modelName); 

        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (response.ok) {
                if (result.predicted_image) {
                    setPredictedImageBase64(result.predicted_image); 
                    if (result.msg === "Found object") {
                        setPredictionMessage(`เจอทุเรียน`)
                    } else {
                        setPredictionMessage(`ไม่พบเจอทุเรียน`)
                    }
                } else {
                    setPredictedImageBase64(result.predicted_image);
                    setPredictionMessage(`โมเดลตรวจไม่พบ`);
                }
                if (!isAuto) setStatus('ทำนายผลสำเร็จ ✅');
            } else {
                setPredictedImageBase64(null);
                setPredictionMessage(null);
                setStatus(`ส่งภาพไม่สำเร็จ: ${result.error || response.statusText}`);
            }
        } catch (error) {
            setPredictedImageBase64(null);
            setPredictionMessage(null);
            setStatus(`เชื่อมต่อ Server ไม่ได้: ${error.message}`);
        } finally {
            setIsSending(false);
            if (isAuto && isAutoDetecting) {
                setStatus(`กำลังทำนายอัตโนมัติ... (${new Date().toLocaleTimeString()})`);
            }
        }
    };

    const handleFileUpload = (event) => {
        stopCamera()
        const file = event.target.files[0];
        if (file) {
            stopCamera();
            setCapturedBlob(file);
            setPredictionMessage(null); 
            setPredictedImageBase64(null); 
            setStatus(`ไฟล์พร้อมส่ง: ${file.name}`);
        }
    };
    
    const takePhotoManual = () => {
        stopAutoDetect();
        if (isCameraActive) {
            takeAndSendPhoto(false);
        }
    }

    const sendImageToBackendManual = () => {
         takeAndSendPhoto(false, capturedBlob);
    }

    const handleSelectModel = (event) => {
        setModelName(event.target.value);
    };
    
    useEffect(() => {
        return () => {
            stopCamera();
            stopAutoDetect();
        };
    }, []);
    
    const previewUrl = capturedBlob ? URL.createObjectURL(capturedBlob) : null;
    
    const predictedImageUrl = predictedImageBase64 
        ? `data:image/png;base64,${predictedImageBase64}` 
        : null;
 
    return (
        <div className="container-sm rounded">
            <h1 className="bg-light text-center text-body">ทำนายความสุกของทุเรียน</h1>

            <p className="text-start text-body">
                <strong>สถานะ:</strong> {status} {isSending ? '(กำลังส่ง...)': ''}
            </p>
            <div className="w-100">
                <label className="text-start text-body">เลือก Model:</label>
                <select 
                    value={modelName} 
                    onChange={handleSelectModel} 
                    disabled={isSending || isAutoDetecting}
                    className="form-select"
                >
                    <option value="new">Augmented</option>
                    <option value="old">No Augment</option>
                </select>
            </div>

            {/*upload file*/}
            <h2 className="text-body">1. อัปโหลดไฟล์</h2>
            <div class="input-group">
                <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileUpload}
                    className="form-control"
                    aria-label="Upload"
                />
            </div>
            
            {/*Camera and option*/}
            <h2 className="text-body">2. กล้อง & Auto Detect</h2>
            <div className="w-100">
                <button 
                    onClick={isCameraActive ? stopCamera : startCamera} 
                    className={isCameraActive ? 'btn btn-success' : 'btn btn-danger'}
                >
                    {isCameraActive ? 'ปิดกล้อง 🔴' : 'เปิดกล้อง 📷'}
                </button>

                {isCameraActive && (
                    <button 
                        onClick={isAutoDetecting ? stopAutoDetect : startAutoDetect} 
                        className={isAutoDetecting ? 'btn btn-warning' : 'btn btn-warning'}
                    >
                        {isAutoDetecting ? 'หยุด Auto Detect 🔴' : 'เริ่ม Auto Detect 🚀'}
                    </button>
                )}
                
                {isCameraActive && !isAutoDetecting && (
                    <button 
                        onClick={takePhotoManual} 
                        className="btn btn-secondary"
                    >
                        ถ่ายภาพ 🖼️
                    </button>
                )}
            </div>
            
            
            <div className="w-100">
                {/* show video camera */}
                <video 
                    ref={videoRef} 
                    autoPlay
                    playsInline={true}
                    className={`${isCameraActive && !isAutoDetecting ? 'show w-100' : 'hidden w-100'}`}
                />
                {/*prediction result*/}
                {(predictedImageUrl && isAutoDetecting) && (
                <div className="w-100">
                    {predictedImageUrl && (
                        <>
                            <img 
                                src={predictedImageUrl} 
                                alt="Predicted Image" 
                                className="w-100"
                            />
                        </>
                    )}


                    {predictionMessage && <p className=""><strong>ข้อความ:</strong> {predictionMessage}</p>}
                </div>
                )}
                {(predictedImageUrl && !isAutoDetecting && !isCameraActive) && (
                <div className="w-100">
                    {predictedImageUrl && (
                        <>
                            <img 
                                src={predictedImageUrl} 
                                alt="Predicted Uploaded Image" 
                                className="w-100"
                            />
                        </>
                    )}


                    {predictionMessage && <p className="text-body text-start"><strong>ผลการทำนาย : </strong> {predictionMessage}</p>}
                </div>
                )}
            </div>
            {previewUrl && !predictedImageUrl && !isAutoDetecting && ( 
                <div className="w-100">
                    <img 
                        src={previewUrl} 
                        alt="Image Preview" 
                        className="w-100"
                    />
                    <button 
                        onClick={sendImageToBackendManual} 
                        disabled={isSending || !capturedBlob}
                        className="btn btn-primary"
                    >
                        {isSending ? 'กำลังส่ง...' : 'ส่งภาพทำนายผล (Manual) 📤'}
                    </button>
                </div>
            )}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
    );
}

export default SimpleImageUploader;
