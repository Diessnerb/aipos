import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-4xl px-4 py-6">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>

        <ScrollArea className="h-[calc(100vh-8rem)]">
          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 pr-4">
            <header className="space-y-2 border-b border-border pb-6">
              <h1 className="text-4xl font-bold text-foreground">Privacy Policy</h1>
              <h2 className="text-xl text-muted-foreground">AIPOS</h2>
              <p className="text-sm text-muted-foreground">Last updated: 11 August 2025</p>
            </header>

            <div className="space-y-8">
              <p className="text-foreground leading-relaxed">
                AIPOS ("we," "our," or "us") provides restaurant management tools including reservations, 
                customer CRM, and related services ("the Service"). This Privacy Policy explains how we 
                collect, use, and protect your information when you use our mobile application and any 
                related services.
              </p>

              <section>
                <h3 className="text-2xl font-semibold text-foreground mb-4">1. Information We Collect</h3>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="text-lg font-medium text-foreground mb-2">a) Information you provide to us</h4>
                    <ul className="list-disc list-inside space-y-1 text-foreground ml-4">
                      <li>Account information: name, email address, phone number, and password (if applicable).</li>
                      <li>Reservation details: guest names, contact details, party size, date, time, and table number.</li>
                      <li>Customer CRM details: customer names, contact details, and visit history.</li>
                      <li>Support requests: information you provide when contacting support.</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-lg font-medium text-foreground mb-2">b) Information collected automatically</h4>
                    <ul className="list-disc list-inside space-y-1 text-foreground ml-4">
                      <li>Device information: device type, operating system, app version.</li>
                      <li>Usage data: actions taken in the app (e.g., creating reservations, adding customers) to improve performance.</li>
                      <li>Log data: IP address, access times, error logs.</li>
                    </ul>
                  </div>

              <div>
                <h4 className="text-lg font-medium text-foreground mb-2">c) Information from third-party services</h4>
                <p className="text-foreground mb-2">
                  If you sign in or connect via third-party services (e.g., Google Sign-In), we may receive 
                  your name, email address, and profile image from that provider.
                </p>
                <p className="text-foreground">
                  When you connect social media accounts (Facebook, Instagram), we collect:
                </p>
                <ul className="list-disc list-inside space-y-1 text-foreground ml-4 mt-2">
                  <li>Facebook/Instagram profile information (username, profile picture)</li>
                  <li>Facebook Pages and Instagram Business Account details</li>
                  <li>Access tokens to enable posting and content management</li>
                  <li>Post content, scheduling information, and analytics data</li>
                </ul>
              </div>
                </div>
              </section>

              <section>
            <h3 className="text-2xl font-semibold text-foreground mb-4">2. How We Use Your Information</h3>
            <ul className="list-disc list-inside space-y-1 text-foreground ml-4">
              <li>Provide and operate the Service.</li>
              <li>Store and manage reservations, customers, and related restaurant data.</li>
              <li>Enable social media integration and post scheduling to your connected Facebook and Instagram accounts.</li>
              <li>Manage marketing campaigns and social media content on your behalf.</li>
                  <li>Improve, personalise, and develop app features.</li>
                  <li>Communicate with you, including service announcements and support.</li>
                  <li>Maintain security, prevent fraud, and comply with laws.</li>
                </ul>
              </section>

              <section>
                <h3 className="text-2xl font-semibold text-foreground mb-4">3. How We Share Your Information</h3>
                <p className="text-foreground mb-4">
                  We do not sell or rent your personal data. We may share your information with:
                </p>
                <ul className="list-disc list-inside space-y-1 text-foreground ml-4">
                  <li>Service providers who help operate the Service (e.g., Supabase for cloud data storage).</li>
                  <li>Social media platforms (Facebook, Instagram) when you choose to connect your accounts and authorize us to post content on your behalf.</li>
                  <li>Legal authorities when required by law, court order, or government request.</li>
                  <li>Business transfers in the event of a merger, acquisition, or asset sale.</li>
                </ul>
                <p className="text-foreground mt-4">
                  <strong>Meta Platform Integration:</strong> When you connect your Facebook or Instagram Business accounts, 
                  we use Meta's APIs to enable posting, content scheduling, and analytics features. Your use of these 
                  integrations is governed by Meta's Platform Terms and Policies, available at 
                  <a href="https://developers.facebook.com/terms" className="text-primary hover:underline ml-1" target="_blank" rel="noopener noreferrer">
                    https://developers.facebook.com/terms
                  </a>.
                </p>
              </section>

              <section>
                <h3 className="text-2xl font-semibold text-foreground mb-4">4. Data Storage & Security</h3>
                <p className="text-foreground">
                  Data is stored securely using Supabase, with encryption in transit (HTTPS/TLS) and at rest. 
                  We implement safeguards to protect against unauthorized access, disclosure, alteration, or destruction.
                </p>
              </section>

              <section>
                <h3 className="text-2xl font-semibold text-foreground mb-4">5. Your Rights & Choices</h3>
                <p className="text-foreground">
                  You may request access, correction, or deletion of your personal information, and you may 
                  withdraw consent to certain data uses. To exercise these rights, contact us at info@aiposnow.ai.
                </p>
              </section>

              <section>
                <h3 className="text-2xl font-semibold text-foreground mb-4">6. Data Retention</h3>
                <p className="text-foreground">
                  We retain information while your account is active or as needed to provide the Service, 
                  and as required for legal/operational purposes.
                </p>
              </section>

              <section>
                <h3 className="text-2xl font-semibold text-foreground mb-4">7. International Transfers</h3>
                <p className="text-foreground">
                  Our servers and service providers may be located outside your country. By using the Service, 
                  you consent to these transfers.
                </p>
              </section>

              <section>
                <h3 className="text-2xl font-semibold text-foreground mb-4">8. Children's Privacy</h3>
                <p className="text-foreground">
                  The Service is not directed to children under 13, and we do not knowingly collect their 
                  personal information. If we learn that we have collected such information, we will delete it.
                </p>
              </section>

              <section>
                <h3 className="text-2xl font-semibold text-foreground mb-4">9. Changes to This Policy</h3>
                <p className="text-foreground">
                  We may update this Privacy Policy from time to time. If material changes occur, we will 
                  notify you via the app or email before they take effect.
                </p>
              </section>

              <section>
                <h3 className="text-2xl font-semibold text-foreground mb-4">10. Contact Us</h3>
                <div className="text-foreground space-y-1">
                  <p className="font-medium">AIPOS</p>
                  <p>info@aiposnow.ai</p>
                  <p>52 South Croft, NR9 3EB, United Kingdom</p>
                </div>
              </section>

              <footer className="border-t border-border pt-6 mt-8">
                <p className="text-sm text-muted-foreground text-center">
                  © AIPOS. All rights reserved.
                </p>
              </footer>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default PrivacyPolicy;