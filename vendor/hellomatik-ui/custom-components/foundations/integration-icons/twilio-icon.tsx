"use client";

import type { SVGProps } from "react";

// Twilio brand icon — official colour #F22F46, circle with two dots pattern
const TwilioIcon = ({ grayscale, ...props }: SVGProps<SVGSVGElement> & { grayscale?: boolean }) => {
    const fill = grayscale ? "currentColor" : "#F22F46";
    return (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-label="Twilio" {...props}>
            <path
                d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm0 20.785c-4.844 0-8.785-3.942-8.785-8.785S7.156 3.215 12 3.215 20.785 7.157 20.785 12 16.844 20.785 12 20.785zm3.246-12.123a1.95 1.95 0 1 0 0 3.9 1.95 1.95 0 0 0 0-3.9zm0 5.538a1.95 1.95 0 1 0 0 3.9 1.95 1.95 0 0 0 0-3.9zm-6.492 0a1.95 1.95 0 1 0 0 3.9 1.95 1.95 0 0 0 0-3.9zm0-5.538a1.95 1.95 0 1 0 0 3.9 1.95 1.95 0 0 0 0-3.9z"
                fill={fill}
            />
        </svg>
    );
};

export default TwilioIcon;
