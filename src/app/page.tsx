'use client'
import React, { useState } from 'react';
import Link from 'next/link';

export default function Home() {
    const [accepted, setAccepted] = useState(false);

    if (!accepted) {
        return (
            <div className="p-4">
                <h1 className="text-2xl font-bold mb-4">Welcome</h1>
                <p className="mb-4">This is not a legal digital signature tool and is for personal use only.</p>
                <button
                    onClick={() => setAccepted(true)}
                    className="bg-blue-500 text-white px-4 py-2 rounded"
                >
                    Accept
                </button>
            </div>
        );
    }

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Welcome</h1>
            <Link
                href="/upload"
                className="bg-blue-500 text-white px-4 py-2 rounded inline-block"
            >
                Go to Upload
            </Link>
        </div>
    );
}