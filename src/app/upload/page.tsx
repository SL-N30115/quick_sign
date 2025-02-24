'use client'
import React, {useEffect, useState} from 'react';
import { useRouter } from 'next/navigation';  // 只需要這個 import
import { Document, Page } from 'react-pdf';
import * as pdfjs from 'pdfjs-dist';
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

export default function Upload() {
    const router = useRouter();  // 使用 hook
    const [file, setFile] = useState<File | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('http://localhost:5000/upload', {
                method: 'POST',
                body: formData,
            });
            const data: { id: string } = await response.json();
            router.push(`/sign/${data.id}`);  // 使用 router 實例
        } catch (error) {
            console.error('Upload failed:', error);
        }
    };

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Upload PDF</h1>
            <form onSubmit={handleUpload}>
                <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="mb-4"
                />
                <button
                    type="submit"
                    className="bg-blue-500 text-white px-4 py-2 rounded"
                    disabled={!file}  // 添加禁用狀態
                >
                    Upload
                </button>
            </form>
        </div>
    );
}
