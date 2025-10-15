import React, { useState, useRef, useEffect } from 'react';
import './App.css'

const API_ENDPOINT = `${process.env.REACT_APP_API_URL}/upload`;

const AUTO_DETECT_INTERVAL_MS = 500;

function SimpleImageUploader() {
    // 1. ตัวแปรสถานะ (State)
    const [capturedBlob, setCapturedBlob] = useState(null); 
    const [status, setStatus] = useState('พร้อมใช้งาน'); 
    const [isCameraActive, setIsCameraActive] = useState(false); 
    const [isAutoDetecting, setIsAutoDetecting] = useState(false); // สถานะ Auto Detect
    const [predictionMessage, setPredictionMessage] = useState(null); 
    const [predictedImageBase64, setPredictedImageBase64] = useState(null); 
    const [isSending, setIsSending] = useState(false); 
    const [modelName, setModelName] = useState('new'); 
    
    // 2. ตัวอ้างอิง (Ref)
    const videoRef = useRef(null); 
    const canvasRef = useRef(null); 
    const streamRef = useRef(null); 
    const autoDetectIntervalRef = useRef(null); // สำหรับเก็บ Timer ID

    // ----------------------------------------------------------------------
    // ฟังก์ชันจัดการกล้องพื้นฐาน
    // ----------------------------------------------------------------------

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

    // ----------------------------------------------------------------------
    // NEW: ฟังก์ชัน Auto Detect (Timer Control)
    // ----------------------------------------------------------------------
    
    // ฟังก์ชันหยุดการทำงานอัตโนมัติ
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

    // ฟังก์ชันเริ่มการทำงานอัตโนมัติ
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
            takeAndSendPhoto(true); // รันฟังก์ชันถ่ายและส่งในโหมด Auto
        }, AUTO_DETECT_INTERVAL_MS);
    };
    
    // ----------------------------------------------------------------------
    // ฟังก์ชันหลัก: ถ่ายภาพและส่งทำนาย (ใช้ได้ทั้ง Manual และ Auto)
    // ----------------------------------------------------------------------

    const takeAndSendPhoto = async (isAuto = false, fileToUpload = null) => {
        let file;

        // 1. จัดการการถ่ายภาพ/เตรียมไฟล์
        if (fileToUpload) {
            file = fileToUpload; // ใช้ไฟล์ที่ถูกอัปโหลด
        } else if (isAuto || isCameraActive) {
            // โหมด Auto หรือ Manual Capture
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
                stopCamera(); // Stop camera only after taking the manual photo
                setStatus('ถ่ายภาพสำเร็จ! กำลังส่งทำนาย...');
            }

        } else if (capturedBlob) {
            // โหมด Manual Send โดยใช้ไฟล์ที่อยู่ใน State
            file = capturedBlob;
        } else {
            return;
        }

        // 2. ส่งข้อมูลไปยัง Backend
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
                if (!isAuto) setStatus('ทำนายผลสำเร็จ ✅'); // อัปเดตสถานะหลักเฉพาะตอน Manual
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
            // ในโหมด Auto, ให้สถานะยังคงเป็น Auto Detecting
            if (isAuto && isAutoDetecting) {
                setStatus(`กำลังทำนายอัตโนมัติ... (${new Date().toLocaleTimeString()})`);
            }
        }
    };
    
    // ----------------------------------------------------------------------
    // Handlers สำหรับ UI
    // ----------------------------------------------------------------------

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (file) {
            stopCamera();
            setCapturedBlob(file);
            setPredictionMessage(null); 
            setPredictedImageBase64(null); 
            setStatus(`ไฟล์พร้อมส่ง: ${file.name}`);
        }
    };
    
    // Manual Capture (เรียก takeAndSendPhoto ในโหมด Manual)
    const takePhotoManual = () => {
        stopAutoDetect(); // ต้องหยุด Auto ก่อน
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
    
    // Clean up effect (เมื่อ Component ถูกถอดออก)
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

    const buttonClass = (bgColor) => `px-4 py-2 rounded-lg font-semibold transition duration-300 ease-in-out shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${bgColor} text-white`;
    const containerClass = "p-6 max-w-2xl mx-auto my-10 bg-white rounded-xl shadow-2xl space-y-6";
    const headerClass = "text-2xl font-bold text-center text-gray-800";
    
    return (
        <div className={containerClass}>
            <h1 className={headerClass}>อัปโหลดและทำนายภาพ (YOLO React)</h1>
            <div className="flex items-center space-x-4">
                <label className="text-sm font-medium text-gray-700">เลือก Model:</label>
                <select 
                    value={modelName} 
                    onChange={handleSelectModel} 
                    disabled={isSending || isAutoDetecting}
                    className="p-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="new">Augmented</option>
                    <option value="old">No Augment</option>
                </select>
            </div>
            <p className="text-center text-sm">
                <strong>สถานะ:</strong> {status} {isSending ? '(กำลังส่ง...)': ''}
            </p>
            
            <div className="w-full h-1 bg-gray-200 rounded-full"></div>

            {/* ---------------------------------- 1. อัปโหลดไฟล์ ---------------------------------- */}
            <h2 className="text-xl font-semibold text-gray-700">1. อัปโหลดไฟล์</h2>
            <input 
                type="file" 
                accept="image/*" 
                onChange={handleFileUpload}
                disabled={isCameraActive || isSending || isAutoDetecting}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
            />
            
            <div className="w-full h-1 bg-gray-200 rounded-full"></div>

            {/* ---------------------------------- 2. กล้อง & Auto Detect ---------------------------------- */}
            <h2 className="text-xl font-semibold text-gray-700">2. กล้อง & Auto Detect</h2>
            <div className="flex flex-wrap gap-2 items-center">
                <button 
                    onClick={isCameraActive ? stopCamera : startCamera} 
                    className={buttonClass(isCameraActive ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600')}
                >
                    {isCameraActive ? 'ปิดกล้อง 🔴' : 'เปิดกล้อง 📷'}
                </button>

                {isCameraActive && (
                    <button 
                        onClick={isAutoDetecting ? stopAutoDetect : startAutoDetect} 
                        className={buttonClass(isAutoDetecting ? 'bg-red-700 hover:bg-red-800' : 'bg-orange-500 hover:bg-orange-600')}
                    >
                        {isAutoDetecting ? 'หยุด Auto Detect 🛑' : 'เริ่ม Auto Detect (2 FPS) 🚀'}
                    </button>
                )}
                
                {isCameraActive && !isAutoDetecting && (
                    <button 
                        onClick={takePhotoManual} 
                        className={buttonClass('bg-purple-500 hover:bg-purple-600')}
                    >
                        ถ่ายภาพ (Manual) 🖼️
                    </button>
                )}
            </div>

            <div className="mt-4 flex justify-center">
                <video 
                    ref={videoRef} 
                    autoPlay
                    playsInline={true}
                    className={`${isCameraActive && !isAutoDetecting ? 'show' : 'hidden'}`}
                />  
                {(predictedImageUrl && isAutoDetecting) && (
                <div className="mt-6 p-4 border-4 border-green-500 rounded-xl bg-green-50">
                    {predictedImageUrl && (
                        <>
                            <img 
                                src={predictedImageUrl} 
                                alt="Predicted Image" 
                                className="max-w-full h-auto mx-auto rounded-lg shadow-xl border-2 border-blue-400"
                            />
                        </>
                    )}


                    {predictionMessage && <p className="mt-3 text-gray-800"><strong>ข้อความ:</strong> {predictionMessage}</p>}
                </div>
                )}
                {(predictedImageUrl && !isAutoDetecting && !isCameraActive) && (
                <div className="mt-6 p-4 border-4 border-green-500 rounded-xl bg-green-50">
                    {predictedImageUrl && (
                        <>
                            <img 
                                src={predictedImageUrl} 
                                alt="Predicted Image" 
                                className="max-w-full h-auto mx-auto rounded-lg shadow-xl border-2 border-blue-400"
                            />
                        </>
                    )}


                    {predictionMessage && <p className="mt-3 text-gray-800"><strong>ข้อความ:</strong> {predictionMessage}</p>}
                </div>
                )}
            </div>
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {previewUrl && !predictedImageUrl && !isAutoDetecting && ( 
                <div className="pre">
                    <img 
                        src={previewUrl} 
                        alt="Image Preview" 
                        className="max-w-full h-auto mx-auto rounded-lg shadow-md"
                    />
                    <button 
                        onClick={sendImageToBackendManual} 
                        disabled={isSending || !capturedBlob}
                        className={buttonClass('bg-green-600 hover:bg-green-700 mt-3')}
                    >
                        {isSending ? 'กำลังส่ง...' : 'ส่งภาพทำนายผล (Manual) 📤'}
                    </button>
                </div>
            )}
        </div>
    );
}

export default SimpleImageUploader;
