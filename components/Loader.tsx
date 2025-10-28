import React from 'react';

interface LoaderProps {
  message: string;
  progress?: number;
  onCancel?: () => void;
}

const Loader: React.FC<LoaderProps> = ({ message, progress, onCancel }) => {
  const isIndeterminate = progress === undefined;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-80 backdrop-blur-sm flex flex-col items-center justify-center z-50 text-white">
      <div className="w-64 text-center">
        <div className="mb-4 text-lg font-semibold">{message}</div>
        <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
          <div 
            className={`bg-[#a6a6a6] h-2.5 rounded-full transition-all duration-300 ease-in-out ${isIndeterminate ? 'animate-pulse' : ''}`}
            style={{ width: isIndeterminate ? '100%' : `${progress}%` }}
          ></div>
        </div>
        {!isIndeterminate && (
          <div className="text-center mt-2 text-sm text-gray-300">{progress}%</div>
        )}
        {onCancel && (
          <button
            onClick={onCancel}
            className="mt-6 px-4 py-2 text-sm font-semibold text-gray-300 bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600 rounded-lg transition-colors"
          >
            取消
          </button>
        )}
      </div>
       <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
          }
          .animate-pulse {
            animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
        `}
      </style>
    </div>
  );
};

export default Loader;