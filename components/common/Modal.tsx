'use client';

import { useEffect, useRef } from 'react';
import styles from './Modal.module.css';
import { useIsMobile } from '@/lib/hooks';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  okText?: string;
  hideFooter?: boolean;
  hideCloseButton?: boolean;
  dark?: boolean;
}

export default function Modal({ 
  isOpen, 
  onClose, 
  title = 'Information',
  children,
  okText = 'OK',
  hideFooter = false,
  hideCloseButton = false,
  dark = false
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  
  const isMobile = useIsMobile();

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      if (isMobile) document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      if (isMobile) document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Close if clicking outside modal
  const handleBackdropClick = (e: React.MouseEvent) => {
    // Stop propagation to prevent triggering parent element clicks
    e.stopPropagation();
    
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  // Safe close handler that stops event propagation
  const handleClose = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className={styles.backdrop}
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div 
        ref={modalRef}
        className={styles.modal}
        role="dialog"
        aria-labelledby="modal-title"
        aria-modal="true"
      >
        <div className={`${styles.header} sticky top-0 z-10 ${dark ? 'bg-black text-white border-b border-white/10' : 'bg-white'}`}>
          <span className='flex flex-row items-center'>
          {!dark && <img src="/bottle.webp" className="w-[60px] -rotate-45" />}
          <h2 id="modal-title" className={`${styles.title} font-luckiest uppercase`}>{title}</h2>
          </span>
         <button 
            onClick={handleClose}
            hidden={hideCloseButton}
            className={`${styles.closeButton} text-3xl font-bold leading-none ${dark ? 'text-white hover:text-gray-300' : 'text-gray-600 hover:text-gray-900'}`}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>
        <div className={`${styles.content} overflow-x-auto ${dark ? 'bg-black text-white' : ''} font-luckiest`} ref={contentRef}>
          {children}
        </div>
        {!hideFooter && (
          <div className={`${styles.footer} sticky bottom-0 z-10 ${dark ? 'bg-black text-white border-t border-white/10' : 'bg-white'}`}>
            <button 
              onClick={handleClose}
              className={`${styles.okButton} ${dark ? 'font-luckiest tracking-wide uppercase rounded-2xl border-2 border-white/60 bg-gradient-to-b from-[#0B0F1A] via-[#111827] to-[#0B1220] text-white px-6 py-2 text-xl shadow-[0_6px_0_rgba(0,0,0,0.4),0_0_14px_rgba(59,130,246,0.25)] hover:brightness-110' : ''}`}
            >
              {okText}
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 