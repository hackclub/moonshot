"use client";

import FormGroup from "@/components/form/FormGroup";
import FormInput from "@/components/form/FormInput";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import FormSelect from "@/components/form/FormSelect";
import countries from "@/types/countries";
import { save, FormSave } from "./actions";
import { useActionState, useEffect, useState, startTransition, useRef } from "react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { signIn } from "next-auth/react";
import Toast from "@/components/common/Toast";
import Link from "next/link";
import { PrefillData } from "@/types/prefill";
import { useSearchParams } from 'next/navigation';

// Client Side Registration Form
//
// If hasSession is true, hide the email/log in with slack option
export default function Form({ hasSession, prefillData }: { hasSession?: boolean, prefillData?: PrefillData }) {
  const [state, formAction, pending] = useActionState(save, {
    errors: undefined,
    data: undefined,
    valid: false,
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('error');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const searchParams = useSearchParams();

  // Initialize with empty strings or potentially prefilled data later in useEffect
  const [formData, setFormData] = useState({
    "First Name": "",
    "Last Name": "",
    "Email": "",
    "Birthday": "",
    ...(searchParams.get('t') ? { "referral_type": searchParams.get('t') } : {}),
    ...(searchParams.get('r') ? { "referral_code": Number(searchParams.get('r')) } : {})
  });
  const hasPrefilled = useRef(false); // Ref to track if prefill happened

  // Use useEffect to set initial state from props ONCE
  useEffect(() => {
    // Only prefill if data exists and hasn't been prefilled yet
    if (prefillData && !hasPrefilled.current &&
        (prefillData.firstName || prefillData.lastName || prefillData.email || prefillData.birthday)) {
      console.log("Applying prefill data:", prefillData);
      setFormData(prev => ({
        ...prev, // Keep any existing state just in case, though likely empty
        "First Name": prefillData.firstName || prev["First Name"],
        "Last Name": prefillData.lastName || prev["Last Name"],
        "Email": prefillData.email || prev["Email"],
        // Ensure birthday is a string, fallback to previous or empty
        "Birthday": prefillData.birthday || prev["Birthday"] || ""
      }));
      hasPrefilled.current = true; // Mark as prefilled
    }
  }, [prefillData]); // Dependency array includes prefillData

  // Update toast when state changes
  useEffect(() => {
    if (state.valid) {
      console.log('Form submission successful:', formData);
      setToastType('success');
      setToastMessage("Thanks! Check your email for next steps.");
      // Clear form data on success only if it wasn't prefilled initially
      // (or always clear, depending on desired behavior)
      setFormData({
        "First Name": "",
        "Last Name": "",
        "Email": "",
        "Birthday": "",
        ...(searchParams.get('t') ? { "referral_type": searchParams.get('t') } : {}),
        ...(searchParams.get('r') ? { "referral_code": Number(searchParams.get('r')) } : {}),
      });
      hasPrefilled.current = false; // Reset prefill tracker for potential subsequent renders
      setIsSubmitting(false);
    } else if (state.errors) {
      console.log('Form submission failed:', state.errors);
      setToastType('error');
      if (state.errors._form && Array.isArray(state.errors._form) && state.errors._form.length > 0 && state.errors._form[0] === "This email is already RSVPed!") {
        setToastMessage("This email is already RSVPed!");
      } else {
        setToastMessage("Ooops - something went wrong.  Please try again later!");
      }
      setIsSubmitting(false);
    }
  }, [state]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) {
      console.log('Prevented duplicate submission attempt');
      return;
    }
    
    // Basic client-side validation (optional, Zod handles server-side)
    if (!formData["First Name"] || !formData["Last Name"] || !formData["Email"] || !formData["Birthday"]) {
         setToastType('error');
         setToastMessage("Please fill in all required fields.");
         return;
    }
    if (!formData["Email"].includes('@')) {
         setToastType('error');
         setToastMessage("Please enter a valid email address.");
         return;
    }

    // Client-side age validation (must be 13-18 inclusive)
    try {
      const birthDate = new Date(formData["Birthday"]);
      if (isNaN(birthDate.getTime())) {
        setToastType('error');
        setToastMessage("Please enter a valid birth date.");
        return;
      }
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      if (age < 13 || age > 18) {
        setToastType('error');
        setToastMessage("You must be between 13 and 18 years old to RSVP.");
        return;
      }
    } catch (err) {
      setToastType('error');
      setToastMessage("Please enter a valid birth date.");
      return;
    }
    
    console.log('Starting form submission:', formData);
    setIsSubmitting(true);
    const data = new FormData();
    Object.entries(formData).forEach(([key, value]) => {      
      // String all null values, don't send 'em at all
      if (value !== null) {
        if (key === "referral_code") {
          console.log(`Adding form field: ${key} = ${value}`);
          data.append(key, String(value));
        } else {
          console.log(`Adding form field: ${key} = ${value}`);
          data.append(key, String(value));  
        }
      }
    });
    console.log('FormData entries:', Array.from(data.entries()));
    try {
      startTransition(() => {
        formAction(data);
      });
    } catch (error) {
      console.error('Form submission error:', error);
      setToastType('error');
      setToastMessage("Ooops - something went wrong submitting.  Please try again later!");
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (fieldName: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const [birthdayDate, setBirthdayDate] = useState<Date | null>(null);
  
  // Calculate date 16 years ago for calendar's initial open date
  const getDefaultCalendarDate = () => {
    const today = new Date();
    return new Date(today.getFullYear() - 16, today.getMonth(), today.getDate());
  };

  const allFilled = (
    (formData["First Name"]?.trim().length ?? 0) > 0 &&
    (formData["Last Name"]?.trim().length ?? 0) > 0 &&
    (formData["Email"]?.trim().length ?? 0) > 0 &&
    (formData["Birthday"]?.trim().length ?? 0) > 0
  );

  const getMissingFields = () => {
    const missing: string[] = [];
    if (!(formData["First Name"]?.trim())) missing.push('First Name');
    if (!(formData["Last Name"]?.trim())) missing.push('Last Name');
    if (!(formData["Email"]?.trim())) missing.push('Email');
    if (!(formData["Birthday"]?.trim())) missing.push('Birthday');
    return missing;
  };

  const handleDisabledClick = () => {
    if (allFilled) return;
    const missing = getMissingFields();
    setToastType('error');
    setToastMessage(`Please complete: ${missing.join(', ')}`);
  };

  return (
    <>
      {toastMessage && (
        <Toast 
          message={toastMessage}
          type={toastType}
          onClose={() => setToastMessage(null)}
        />
      )}
          <div className="z-20 mx-5 flex flex-col items-center gap-4 rounded-lg border-2 border-[#333333] bg-[#22222266] px-0 py-3 [filter:drop-shadow(5px_5px_20px_rgba(255,255,255,0.1))] backdrop-blur-3xl transition-all duration-300 hover:[filter:drop-shadow(5px_5px_20px_rgba(255,255,255,0.3))] md:p-6 max-h-[90vh] overflow-y-auto">
          <div>
          <h3 id="rsvp" className="font-luckiest px-3 text-center text-4xl md:text-5xl leading-tight text-white" aria-label="MOONSHOT">
            {(() => {
              const text = 'MOONSHOT';
              const slotSeconds = 1.2; // time allocated per letter (spaced out)
              return text.split('').map((ch, i) => (
                <span
                  key={i}
                  className="inline-block moonshot-letter font-luckiest"
                  style={{
                    animationDelay: `${i * slotSeconds}s`,
                    // total duration makes pulses sequential and non-overlapping
                    animationDuration: `${text.length * slotSeconds}s`,
                  }}
                >
                  {ch}
                </span>
              ));
            })()}
          </h3>
          <p className="mt-2 text-center text-lg md:text-xl text-white" style={{ fontFamily: 'var(--font-luckiest), cursive' }}>
          DECEMBER 12-15 - ORLANDO, FL<br></br>
          TEENS 13 TO 18 ONLY
          </p>
        </div>

        <form className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-lg md:text-xl font-luckiest items-start content-start" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-0.5">
        <FormInput
              fieldName="First Name"
              state={state}
              placeholder="Prophet"
              required
              value={formData["First Name"]}
              onChange={(e) => handleInputChange("First Name", e.target.value)}
              inputStyle="font-luckiest placeholder:font-luckiest"
              textStyle="font-luckiest"
            >
              First Name
            </FormInput>
          </div>
          <div className="flex flex-col gap-0.5">
            <FormInput
              fieldName="Last Name"
              state={state}
              placeholder="Orpheus"
              required
              value={formData["Last Name"]}
              onChange={(e) => handleInputChange("Last Name", e.target.value)}
              inputStyle="font-luckiest placeholder:font-luckiest"
              textStyle="font-luckiest"
            >
              Last Name
            </FormInput>
          </div>

          <div className="flex flex-col gap-0.5">
          <FormInput
              fieldName="Email"
              type="email"
              state={state}
              placeholder="orpheus@hackclub.com"
              required
              value={formData["Email"]}
              onChange={(e) => handleInputChange("Email", e.target.value)}
              inputStyle="font-luckiest placeholder:font-luckiest"
              textStyle="font-luckiest"
            >
              Email
            </FormInput>
          </div>
          <div className="flex flex-col gap-0.5 md:col-start-2 md:row-start-2 px-[13px] pt-[13px]">
            <label className="md:text-lg text-base font-semibold text-left text-sand font-luckiest" style={{
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale',
              letterSpacing: '0.01em'
            }}>Birthday</label>
            <DatePicker
              selected={birthdayDate}
              onChange={(date: Date | null) => {
                setBirthdayDate(date);
                handleInputChange("Birthday", date ? date.toISOString().slice(0, 10) : "");
              }}
              openToDate={getDefaultCalendarDate()}
              placeholderText="mm/dd/yyyy"
              dateFormat="MM/dd/yyyy"
              showMonthDropdown
              showYearDropdown
              dropdownMode="select"
              className="md:text-base text-sm w-full px-3 sm:px-4 md:py-2 py-1.5 bg-white text-dark-brown disabled:bg-gray-200 rounded outline-1 outline-gray-200 font-luckiest font-normal placeholder:font-luckiest"
              wrapperClassName="w-full"
              withPortal
              portalId="root-portal"
            />
          </div>

            <div className="col-span-1 md:col-span-2 flex justify-center mt-1">
              <div className="relative inline-block">
                <button
                  className={`font-luckiest tracking-wide uppercase cursor-pointer rounded-2xl border-2 border-white/60 bg-gradient-to-b from-[#0B0F1A] via-[#111827] to-[#0B1220] px-6 py-3 md:px-10 md:py-4 text-2xl md:text-4xl text-white shadow-[0_10px_0_rgba(0,0,0,0.4),0_0_20px_rgba(59,130,246,0.25)] hover:brightness-110 text-center ${allFilled ? 'wiggle-scale' : ''} ${(!allFilled || isSubmitting) ? 'opacity-60 cursor-not-allowed' : ''}`}
                  disabled={!allFilled || isSubmitting}
                  type="submit"
                >
                  <span className="flex items-center gap-1 flex-nowrap font-luckiest">
                    {isSubmitting ? "Submitting..." : "Submit"}
                  </span>
                </button>
                {!allFilled && !isSubmitting && (
                  <div
                    className="absolute inset-0 z-10 rounded-2xl cursor-not-allowed"
                    role="button"
                    tabIndex={0}
                    aria-disabled="true"
                    onClick={handleDisabledClick}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleDisabledClick(); }}
                  />
                )}
              </div>
            </div>
        </form>
      </div>
      <style jsx>{`
        @keyframes moonshotPulse {
          0% { filter: drop-shadow(0 0 0 rgba(255,255,255,0)); }
          4% { filter: drop-shadow(0 0 12px rgba(255,255,255,0.95)); }
          8% { filter: drop-shadow(0 0 0 rgba(255,255,255,0)); }
          50% { filter: drop-shadow(0 0 0 rgba(255,255,255,0)); }
          54% { filter: drop-shadow(0 0 12px rgba(255,255,255,0.95)); }
          58% { filter: drop-shadow(0 0 0 rgba(255,255,255,0)); }
          100% { filter: drop-shadow(0 0 0 rgba(255,255,255,0)); }
        }
        .moonshot-letter { animation-name: moonshotPulse; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
        /* Date input: use Luckiest Guy (regular) with smoothing so it doesn't appear heavier */
        .calendar-input,
        .calendar-input::-webkit-datetime-edit,
        .calendar-input::-webkit-datetime-edit-text,
        .calendar-input::-webkit-datetime-edit-month-field,
        .calendar-input::-webkit-datetime-edit-day-field,
        .calendar-input::-webkit-datetime-edit-year-field,
        .calendar-input::-webkit-calendar-picker-indicator,
        .calendar-input::-webkit-clear-button,
        .calendar-input::-webkit-inner-spin-button {
          font-family: var(--font-luckiest), 'Luckiest Guy', cursive !important;
          font-weight: 400 !important;
          font-size: 15px !important;
          letter-spacing: 0.01em !important;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        .calendar-input::placeholder { font-family: var(--font-luckiest), 'Luckiest Guy', cursive !important; font-weight: 400 !important; font-size: 15px !important; letter-spacing: 0.01em !important; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
        @-moz-document url-prefix() {
          .calendar-input { font-family: var(--font-luckiest), 'Luckiest Guy', cursive !important; font-weight: 400 !important; font-size: 15px !important; letter-spacing: 0.01em !important; -moz-osx-font-smoothing: grayscale; }
        }
        /* Adjust datepicker popper to align close to input and ensure visibility on mobile */
        /* Make react-datepicker wrapper containers fill and align like our inputs */
        :global(.react-datepicker-wrapper) { width: 100%; display: block; }
        :global(.react-datepicker__input-container) { width: 100%; display: block; }
        :global(.react-datepicker__input-container input) {
          box-sizing: border-box;
          font-family: var(--font-luckiest), 'Luckiest Guy', cursive !important;
          font-weight: 400 !important;
        }
        /* Portal: center the calendar in the viewport with a subtle backdrop */
        :global(#root-portal) {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          z-index: 9999 !important;
          pointer-events: none !important;
        }
        :global(#root-portal > *) {
          pointer-events: auto !important;
        }
        :global(.react-datepicker__portal) {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          z-index: 9999 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          background: rgba(0, 0, 0, 0.6) !important;
          padding: 20px !important;
        }
        :global(.react-datepicker__portal .react-datepicker) {
          position: relative !important;
          margin: auto !important;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6) !important;
          border-radius: 12px !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          overflow: hidden !important;
          max-width: min(400px, 90vw) !important;
        }
        /* Ensure calendar components are properly sized */
        :global(.react-datepicker__portal .react-datepicker__month-container) {
          float: none !important;
          width: 100% !important;
        }
        :global(.react-datepicker__portal .react-datepicker__header) {
          background-color: #f0f0f0 !important;
          border-bottom: 1px solid #d0d0d0 !important;
          padding: 12px 0 !important;
        }
        :global(.react-datepicker__portal .react-datepicker__current-month) {
          font-size: 1rem !important;
          font-weight: 600 !important;
          padding: 4px 0 !important;
        }
        :global(.react-datepicker__portal .react-datepicker__month) {
          margin: 0.4rem !important;
        }
        :global(.react-datepicker__portal .react-datepicker__day-names) {
          display: flex !important;
          justify-content: space-around !important;
          padding: 0 0.4rem !important;
        }
        :global(.react-datepicker__portal .react-datepicker__week) {
          display: flex !important;
          justify-content: space-around !important;
          padding: 0 0.4rem !important;
        }
        :global(.react-datepicker__portal .react-datepicker__day-name),
        :global(.react-datepicker__portal .react-datepicker__day) {
          width: 2.2rem !important;
          height: 2.2rem !important;
          line-height: 2.2rem !important;
          margin: 0.2rem !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
      `}</style>
    </>
  );
}
