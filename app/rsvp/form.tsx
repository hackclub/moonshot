"use client";

import FormGroup from "@/components/form/FormGroup";
import FormInput from "@/components/form/FormInput";
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

  return (
    <>
      {toastMessage && (
        <Toast 
          message={toastMessage}
          type={toastType}
          onClose={() => setToastMessage(null)}
        />
      )}
          <div className="z-20 mx-5 flex flex-col items-center gap-10 rounded-lg border-2 border-[#333333] bg-[#22222266] px-0 py-5 [filter:drop-shadow(5px_5px_20px_rgba(255,255,255,0.1))] backdrop-blur-3xl transition-all duration-300 hover:[filter:drop-shadow(5px_5px_20px_rgba(255,255,255,0.3))] md:p-10">
          <div>
          <h2 id="rsvp" className="font-quintessential px-5 text-center text-5xl">
            RSVP for Moonshot!
          </h2>
          <p className="font-quintessential mt-5 text-center text-xl">
            Moonshot is for teenagers ages 13 to 18
          </p>
        </div>

        <form className="grid grid-cols-1 gap-x-10 gap-y-5 text-xl md:grid-cols-2" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1">
        <FormInput
              fieldName="First Name"
              state={state}
              placeholder="Prophet"
              required
              value={formData["First Name"]}
              onChange={(e) => handleInputChange("First Name", e.target.value)}
              inputStyle="min-w-52 rounded-lg bg-white p-2 text-black outline-0 font-quintessential"
              textStyle="font-quintessential"
            >
              First Name
            </FormInput>
          </div>
          <div className="flex flex-col gap-1">
            <FormInput
              fieldName="Last Name"
              state={state}
              placeholder="Orpheus"
              required
              value={formData["Last Name"]}
              onChange={(e) => handleInputChange("Last Name", e.target.value)}
              inputStyle="min-w-52 rounded-lg bg-white p-2 text-black outline-0 font-quintessential"
              textStyle="font-quintessential"
            >
              Last Name
            </FormInput>
          </div>

          <div className="flex flex-col gap-1">
          <FormInput
              fieldName="Email"
              type="email"
              state={state}
              placeholder="orpheus@hackclub.com"
              required
              value={formData["Email"]}
              onChange={(e) => handleInputChange("Email", e.target.value)}
              inputStyle="min-w-52 rounded-lg bg-white p-2 text-black outline-0 font-quintessential"
              textStyle="font-quintessential"
            >
              Email
            </FormInput>
          </div>
          <div className="flex flex-col gap-1">
            <FormInput
              fieldName="Birthday"
              type="date"
              state={state}
              placeholder=""
              required
              value={formData["Birthday"]}
              onChange={(e) => handleInputChange("Birthday", e.target.value)}
              inputStyle="min-w-52 rounded-lg bg-white p-2 text-black outline-0 font-quintessential"
              textStyle="font-quintessential"
            >
              Birthday
            </FormInput>
          </div>

            <div className="col-span-1 md:col-span-2 flex justify-center">
              <button
                className="font-quintessential cursor-pointer rounded-full border-2 border-white bg-black px-4 py-2 text-2xl text-white hover:animate-pulse text-center"
                disabled={isSubmitting}
                type="submit"
              >
                <span className="flex items-center gap-1 flex-nowrap font-quintessential">
                  {isSubmitting ? "Submitting..." : "Submit"}
                </span>
              </button>
            </div>
        </form>
      </div>
    </>
  );
}
