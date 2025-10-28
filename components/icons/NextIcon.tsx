import React from 'react';

const NextIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path fillRule="evenodd" d="M3.75 5.25a.75.75 0 01.75-.75h15a.75.75 0 01.75.75v13.5a.75.75 0 01-1.5 0V6.94L5.03 20.03a.75.75 0 01-1.06-1.06L17.06 5.25H3.75z" clipRule="evenodd" />
  </svg>
);

const SkipNextIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.25V15.75a2.25 2.25 0 0 0 2.25 2.25h13.5A2.25 2.25 0 0 0 21 15.75V8.25M3 8.25V6.375c0-.621.504-1.125 1.125-1.125h14.75c.621 0 1.125.504 1.125 1.125V8.25m-18 0h18" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 12h7.5" />
  </svg>
);


const NextIconCombined: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 15l3-3m0 0l-3-3m3 3h-7.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

export default NextIconCombined;
