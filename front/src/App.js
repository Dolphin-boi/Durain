import React, { useState, useRef} from 'react';
import './App.css';

// Endpoint ของ Flask Backend
// const API_ENDPOINT = 'https://91e9f88adc26.ngrok-free.app//upload'
const API_ENDPOINT = 'http://127.0.0.1:5000/upload'

function SimpleImageUploader() {
    // 1. ตัวแปรสถานะ (State)
    const [capturedBlob, setCapturedBlob] = useState(null); 
    const [status, setStatus] = useState('พร้อมใช้งาน'); 
    const [isCameraActive, setIsCameraActive] = useState(false); 
    const [predictionMessage, setPredictionMessage] = useState(null); 
    const [predictedImageBase64, setPredictedImageBase64] = useState(null); // <--- State สำหรับ Base64 String ของรูปภาพทำนายผล
    const [isSending, setIsSending] = useState(false); 
    const [modelName, setModelName] = useState('new'); 

    // 2. ตัวอ้างอิง (Ref)
    const videoRef = useRef(null); 
    const canvasRef = useRef(null); 
    const streamRef = useRef(null); 

    // ----------------------------------------------------------------------
    // ฟังก์ชันช่วยจัดการกล้อง (ไม่เปลี่ยนแปลง)
    // ----------------------------------------------------------------------

    const stopCamera = () => {
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
        setPredictedImageBase64(null); // เคลียร์ภาพผลลัพธ์
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
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
    // การจัดการไฟล์และภาพถ่าย (ปรับให้เคลียร์ผลลัพธ์ใหม่)
    // ----------------------------------------------------------------------

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (file) {
            stopCamera();
            setCapturedBlob(file);
            setPredictionMessage(null); 
            setPredictedImageBase64(null); // เคลียร์ภาพผลลัพธ์
            setStatus(`ไฟล์พร้อมส่ง: ${file.name}`);
        }
    };

    const takePhoto = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        if (!video || !canvas) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
            const file = new File([blob], "captured_image.jpeg", { type: "image/jpeg" });
            setCapturedBlob(file);
            stopCamera();
            setPredictionMessage(null); 
            setPredictedImageBase64(null); // เคลียร์ภาพผลลัพธ์
            setStatus('ถ่ายภาพสำเร็จ! ไฟล์พร้อมส่ง 🖼️');
        }, 'image/jpeg', 0.95);
    };

    // ----------------------------------------------------------------------
    // การส่งข้อมูลไปยัง Backend: ส่วนที่แก้ไขเพื่อรับ Base64 Image
    // ----------------------------------------------------------------------

    const sendImageToBackend = async () => {
        if (!capturedBlob) return;

        setIsSending(true);
        setStatus('กำลังส่งภาพ...');
        setPredictionMessage(null);
        setPredictedImageBase64(null);

        const formData = new FormData();
        formData.append('file', capturedBlob, capturedBlob.name); 
        formData.append('model', modelName); 

        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (response.ok) {
                setStatus(`ทำนายผลสำเร็จ ✅`);
                
                // *** การจัดการ Base64 Image ที่ส่งมาจาก Backend ***
                if (result.predicted_image) {
                    setPredictedImageBase64(result.predicted_image); // เก็บ Base64 string
                    setPredictionMessage('พบวัตถุ! แสดงผลบนภาพที่ทำนายแล้ว');
                } else if (result.prediction === "No object detected") {
                    setPredictionMessage(result.prediction);
                } else {
                    setPredictionMessage(result.msg || 'ทำนายผลสำเร็จ แต่ไม่ได้รับภาพผลลัพธ์');
                }

            } else {
                setStatus(`ส่งภาพไม่สำเร็จ: ${result.error || response.statusText}`);
                setPredictionMessage(null);
            }
        } catch (error) {
            setStatus(`เชื่อมต่อ Server ไม่ได้: ${error.message}`);
            setPredictionMessage(null);
        } finally {
            setIsSending(false);
        }
    };

    const handleSelectModel = (event) => {
        setModelName(event.target.value);
    };
    
    // URL สำหรับภาพตัวอย่าง (ภาพต้นฉบับก่อนส่ง)
    const previewUrl = capturedBlob ? URL.createObjectURL(capturedBlob) : null;
    
    // ** การแปลง Base64 string ให้เป็น Data URL **
    const predictedImageUrl = predictedImageBase64 
        ? `data:image/png;base64,${predictedImageBase64}` 
        : null;

    // ----------------------------------------------------------------------
    // 4. การแสดงผล (Render): ส่วนที่แก้ไขเพื่อแสดงภาพทำนายผล
    // ----------------------------------------------------------------------
    
    return (
        <div className='Main'>
            <h1>อัปโหลดและทำนายภาพ (YOLO React)</h1>
            <p><strong>สถานะ:</strong> {status}</p>
            <hr />

            <h2>1. อัปโหลดไฟล์</h2>
            <input 
                type="file" 
                accept="image/*" 
                onChange={handleFileUpload}
                disabled={isCameraActive || isSending}
            />

            <hr />

            <h2>2. ถ่ายภาพจากกล้อง</h2>
            <button onClick={isCameraActive ? stopCamera : startCamera} disabled={isSending}>
                {isCameraActive ? 'ปิดกล้อง' : 'เปิดกล้อง'}
            </button>
            
            {isCameraActive && (
                <button onClick={takePhoto} disabled={isSending}>
                    ถ่ายภาพ
                </button>
            )}

            <div style={{ marginTop: '10px' }}>
                <video 
                    ref={videoRef} 
                    autoPlay 
                    style={{ 
                        width: isCameraActive ? '100%' : '0', 
                        maxWidth: '400px',
                        display: isCameraActive ? 'block' : 'none',
                        border: '1px solid black' 
                    }}
                />
            </div>

            <canvas ref={canvasRef} style={{ display: 'none' }} />

            <hr />

            <h2>3. ดูตัวอย่าง & ส่งข้อมูล</h2>
            <select value={modelName} onChange={handleSelectModel}>
                <option selected value="new">Augmented</option>
                <option value="old">No Augment</option>
            </select>
            {/* แสดงภาพต้นฉบับก่อนส่ง (เฉพาะเมื่อยังไม่มีภาพทำนายผล) */}
            {previewUrl && !predictedImageUrl && ( 
                <div style={{ marginTop: '10px' }}>
                    <h3>ภาพต้นฉบับ</h3>
                    <img 
                        src={previewUrl} 
                        alt="Image Preview" 
                        style={{ maxWidth: '400px', maxHeight: '400px', display: 'block', border: '1px solid gray' }}
                    />
                    <button 
                        onClick={sendImageToBackend} 
                        disabled={isSending || !capturedBlob}
                        style={{ marginTop: '10px', backgroundColor: 'green', color: 'white' }}
                    >
                        {isSending ? 'กำลังส่ง...' : 'ส่งภาพทำนายผล'}
                    </button>
                </div>
            )}
            
            {/* ส่วนแสดงผลการทำนาย (ภาพและข้อความ) */}
            {(predictedImageUrl || predictionMessage) && (
                <div style={{ marginTop: '20px', padding: '10px', border: '2px solid green' }}>
                    <h3>ผลการทำนาย YOLO:</h3>
                    
                    {/* ** แท็ก <img> ที่แสดงภาพ Base64 ที่ถอดรหัสแล้ว ** */}
                    {predictedImageUrl && (
                        <>
                            <h4>ภาพผลลัพธ์</h4>
                            <img 
                                src={predictedImageUrl} 
                                alt="Predicted Image" 
                                style={{ maxWidth: '400px', maxHeight: '400px', display: 'block', border: '1px solid blue' }}
                            />
                            <button 
                                onClick={sendImageToBackend} 
                                disabled={isSending || !capturedBlob}
                                style={{ marginTop: '10px', backgroundColor: 'green', color: 'white' }}
                            >
                                {isSending ? 'กำลังส่ง...' : 'ส่งภาพทำนายผลอีกครั้ง'}
                            </button>
                        </>
                    )}

                    {/* แสดงข้อความผลลัพธ์ (เช่น "No object detected") */}
                    {predictionMessage && <p><strong>ข้อความ:</strong> {predictionMessage}</p>}
                    
                </div>
            )}
        </div>
    );
}

export default SimpleImageUploader;