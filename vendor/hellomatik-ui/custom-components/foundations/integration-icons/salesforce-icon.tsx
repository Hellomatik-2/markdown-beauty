"use client";

import type { SVGProps } from "react";

// Salesforce brand icon — cloud logo, official brand colour #00A1E0
const SalesforceIcon = ({ grayscale, ...props }: SVGProps<SVGSVGElement> & { grayscale?: boolean }) => {
    return (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-label="Salesforce" {...props}>
            <path
                d="M9.617 3.457a4.257 4.257 0 0 1 2.928-1.16 4.282 4.282 0 0 1 3.641 2.017 5.248 5.248 0 0 1 1.763-.307c2.913 0 5.275 2.362 5.275 5.275 0 .278-.022.55-.063.816A4.24 4.24 0 0 1 24 13.387c0 2.348-1.903 4.25-4.25 4.25a4.24 4.24 0 0 1-.78-.073H5.417a4.677 4.677 0 0 1-.418.019C2.243 17.583 0 15.34 0 12.583a4.677 4.677 0 0 1 2.757-4.258 5.307 5.307 0 0 1-.1-1.013c0-3.02 2.449-5.469 5.469-5.469a5.46 5.46 0 0 1 1.491.614z"
                fill={grayscale ? "currentColor" : "#00A1E0"}
            />
        </svg>
    );
};

export default SalesforceIcon;
