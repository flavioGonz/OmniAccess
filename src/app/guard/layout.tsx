import React from "react";

export default function GuardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="fixed inset-0 bg-black text-white overflow-hidden selection:bg-[#B20D30] selection:text-white">
            {children}
        </div>
    );
}
