
import React, { useState, useContext, ChangeEvent } from 'react';
import { AppContext, ToastType } from '../context/AppContext';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { verifyMedicalCardImage } from '../services/geminiService';
import { MadeByTekguyz } from '../components/MadeByTekguyzBadge';
import Logo from '../components/Logo';

const Login: React.FC = () => {
  const { handleLogin, handleSignUp } = useContext(AppContext);
  const [isSignUpModalOpen, setSignUpModalOpen] = useState(false);

  const handleDemoLogin = () => {
    // Log in with the first mock user.
    handleLogin('ryder@example.com', 'password');
  };

  return (
    <div className="min-h-screen bg-dark-bg flex flex-col animate-gradient-flow">
      <main className="flex-grow flex flex-col items-center justify-center text-center px-4">
        <div className="max-w-4xl animate-fade-in" style={{animationDelay: '200ms'}}>
          <Logo className="mb-8 justify-center" />
          <h1 className="text-5xl md:text-7xl font-bold text-brand-primary tracking-widest leading-tight">
            FIND YOUR VIBE.
          </h1>
          <p className="mt-4 text-lg md:text-xl text-brand-secondary max-w-2xl mx-auto">
            The exclusive network for Florida's medical cannabis community. Discover private sessions, connect with your crew, and share the experience.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button onClick={() => setSignUpModalOpen(true)} size="lg" variant="primary">Join Early Access</Button>
            <Button onClick={handleDemoLogin} size="lg" variant="secondary">Try Demo</Button>
          </div>
          <div className="mt-6 w-full max-w-xs mx-auto">
             <GoogleSignInButton />
          </div>
        </div>

        <div className="w-full max-w-5xl mt-16 grid md:grid-cols-3 gap-8 animate-fade-in" style={{animationDelay: '400ms'}}>
            <FeatureCard title="AI Verified" description="Our Gemini-powered AI verifies every member's medical card, ensuring a safe and legitimate community." />
            <FeatureCard title="Discover Sessions" description="Find or host private get-togethers, from chill game nights to creative workshops." />
            <FeatureCard title="Build Your Crew" description="Connect with like-minded individuals and grow your trusted circle." />
        </div>
      </main>

      <SignUpWizard isOpen={isSignUpModalOpen} onClose={() => setSignUpModalOpen(false)} onSignUp={handleSignUp} />
      <MadeByTekguyz theme="dark" />
    </div>
  );
};

const GoogleSignInButton = () => (
    <button className="w-full inline-flex items-center justify-center py-2 px-4 border-2 border-brand-secondary/50 rounded-md shadow-sm bg-dark-surface text-sm font-medium text-dark-text hover:bg-dark-bg/50 transition-colors">
        <svg className="w-5 h-5 mr-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.75 8.36,4.73 12.19,4.73C14.03,4.73 15.6,5.36 16.81,6.45L19.25,4.03C17.2,2.34 14.83,1.5 12.19,1.5C6.92,1.5 3,6.08 3,12C3,17.92 6.92,22.5 12.19,22.5C17.6,22.5 21.6,18.34 21.6,12.25C21.6,11.83 21.5,11.45 21.35,11.1Z"></path></svg>
        Sign in with Google
        {/* Note: This is a visual representation. Netlify Identity/Auth0 would be needed for full functionality. */}
    </button>
)

const FeatureCard: React.FC<{title: string, description: string}> = ({title, description}) => (
    <div className="border-2 border-brand-primary/20 p-6 rounded-lg">
        <h3 className="text-xl font-bold text-brand-secondary mb-2">{title}</h3>
        <p className="text-sm text-dark-text/80">{description}</p>
    </div>
)

const SignUpWizard: React.FC<{isOpen: boolean, onClose: () => void, onSignUp: (details: any) => boolean}> = ({isOpen, onClose, onSignUp}) => {
    const { showToast } = useContext(AppContext);
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [verificationResult, setVerificationResult] = useState<{isVerified: boolean; reason: string} | null>(null);
    
    const [formData, setFormData] = useState({
        name: '', email: '', password: '', patientId: '', expiryDate: '', cardImage: null as File | null,
    });
    
    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFormData(prev => ({ ...prev, cardImage: e.target.files![0] }));
        }
    };
    
    const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
    });

    const goToStep2 = () => {
        if (!formData.name || !formData.email || !formData.password) {
            showToast('Please fill out all account details.', ToastType.Error);
            return;
        }
        setStep(2);
    }

    const handleVerification = async () => {
        if (!formData.cardImage || !formData.patientId || !formData.expiryDate) {
            showToast('Please complete all fields and upload an image.', ToastType.Error);
            return;
        }
        setIsLoading(true);
        setVerificationResult(null);

        try {
            const base64Image = await toBase64(formData.cardImage);
            const result = await verifyMedicalCardImage(base64Image, formData.cardImage.type, formData.patientId, formData.expiryDate);

            setVerificationResult(result);
            if (result.isVerified) {
                showToast(result.reason, ToastType.Success);
                setTimeout(() => setStep(3), 1500);
            } else {
                showToast(result.reason, ToastType.Error);
            }
        } catch (error) {
            showToast('An unexpected error occurred during verification.', ToastType.Error);
        } finally {
            setIsLoading(false);
        }
    };

    const finishSignUp = () => {
        if(onSignUp(formData)) {
            onClose();
            // A success toast is shown in handleSignUp context
        } else {
            showToast('An unknown error occurred during sign up.', ToastType.Error);
        }
    }

    const resetWizard = () => {
        setStep(1);
        setIsLoading(false);
        setVerificationResult(null);
        setFormData({ name: '', email: '', password: '', patientId: '', expiryDate: '', cardImage: null });
    }

    const handleClose = () => {
        resetWizard();
        onClose();
    }
    
    return (
        <Modal isOpen={isOpen} onClose={handleClose} title={`Sign Up - Step ${step}`}>
            {step === 1 && (
                <div className="space-y-4">
                    <Input name="name" label="Username" placeholder="NeonRyder" value={formData.name} onChange={handleInputChange} required />
                    <Input name="email" type="email" label="Email" placeholder="you@example.com" value={formData.email} onChange={handleInputChange} required />
                    <Input name="password" type="password" label="Password" placeholder="••••••••" value={formData.password} onChange={handleInputChange} required />
                    <Button onClick={goToStep2} className="w-full">Next</Button>
                </div>
            )}
            {step === 2 && (
                <div className="space-y-4">
                    <p className="text-sm text-brand-secondary">AI-Powered Verification</p>
                    <Input name="patientId" label="Patient ID #" placeholder="P1234567" value={formData.patientId} onChange={handleInputChange} required />
                    <Input name="expiryDate" type="date" label="Card Expiry Date" value={formData.expiryDate} onChange={handleInputChange} required />
                    <div>
                        <label className="block text-sm font-medium text-brand-primary/80 mb-1">Upload Card Photo</label>
                        <input type="file" accept="image/*" onChange={handleFileChange} className="w-full text-sm text-dark-text file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brand-primary file:text-black hover:file:bg-brand-primary/80" required />
                    </div>
                    <Button onClick={handleVerification} disabled={isLoading} className="w-full">
                        {isLoading ? 'Verifying...' : 'Verify My Card'}
                    </Button>
                </div>
            )}
            {step === 3 && (
                 <div className="text-center space-y-4">
                     <h3 className="text-2xl font-bold text-green-400">Verification Successful!</h3>
                     <p>Welcome to the crew, {formData.name}. Your vibe is officially certified.</p>
                     <Button onClick={finishSignUp} className="w-full">Enter the Green Room</Button>
                 </div>
            )}
        </Modal>
    )
}

export default Login;