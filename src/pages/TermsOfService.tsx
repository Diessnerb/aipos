import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

const TermsOfService = () => {
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
              <h1 className="text-4xl font-bold text-foreground">Terms of Service</h1>
              <h2 className="text-xl text-muted-foreground">AIPOS</h2>
              <p className="text-sm text-muted-foreground">Last updated: November 14, 2025</p>
            </header>

            <div className="space-y-8">
              <p className="text-foreground leading-relaxed">
                These Terms of Service ("Terms") govern your access to and use of AIPOS ("we," "our," or "us"), 
                including our restaurant management platform, mobile applications, and related services 
                (collectively, the "Service"). By accessing or using the Service, you agree to be bound by these Terms.
              </p>

              <section>
                <h3 className="text-2xl font-semibold text-foreground mb-4">1. Acceptance of Terms</h3>
                <p className="text-foreground leading-relaxed">
                  By creating an account or using the Service, you acknowledge that you have read, understood, 
                  and agree to be bound by these Terms and our Privacy Policy. If you do not agree to these Terms, 
                  you may not access or use the Service.
                </p>
              </section>

              <section>
                <h3 className="text-2xl font-semibold text-foreground mb-4">2. Description of Service</h3>
                <p className="text-foreground leading-relaxed mb-4">
                  AIPOS provides a comprehensive restaurant management platform that includes:
                </p>
                <ul className="list-disc list-inside space-y-1 text-foreground ml-4">
                  <li>Point of Sale (POS) system</li>
                  <li>Reservation management</li>
                  <li>Customer relationship management (CRM)</li>
                  <li>Kitchen display system</li>
                  <li>Menu and inventory management</li>
                  <li>Marketing tools and social media integration</li>
                  <li>Analytics and reporting</li>
                  <li>Staff management and scheduling</li>
                </ul>
              </section>

              <section>
                <h3 className="text-2xl font-semibold text-foreground mb-4">3. Account Registration and Security</h3>
                <div className="space-y-3">
                  <div>
                    <h4 className="text-lg font-medium text-foreground mb-2">a) Account Creation</h4>
                    <p className="text-foreground">
                      You must create an account to use the Service. You agree to provide accurate, current, 
                      and complete information during registration and to update such information to keep it accurate.
                    </p>
                  </div>
                  <div>
                    <h4 className="text-lg font-medium text-foreground mb-2">b) Account Security</h4>
                    <p className="text-foreground">
                      You are responsible for maintaining the confidentiality of your account credentials and for 
                      all activities that occur under your account. You agree to notify us immediately of any 
                      unauthorized use of your account.
                    </p>
                  </div>
                  <div>
                    <h4 className="text-lg font-medium text-foreground mb-2">c) Team Members</h4>
                    <p className="text-foreground">
                      You are responsible for all actions taken by team members you add to your account and for 
                      ensuring they comply with these Terms.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-2xl font-semibold text-foreground mb-4">4. User Responsibilities</h3>
                <p className="text-foreground mb-3">You agree to:</p>
                <ul className="list-disc list-inside space-y-1 text-foreground ml-4">
                  <li>Use the Service only for lawful purposes and in accordance with these Terms</li>
                  <li>Not use the Service in any way that violates any applicable laws or regulations</li>
                  <li>Not transmit any viruses, malware, or other malicious code</li>
                  <li>Not attempt to gain unauthorized access to any part of the Service</li>
                  <li>Not interfere with or disrupt the Service or servers</li>
                  <li>Not use the Service to send spam or unsolicited communications</li>
                  <li>Comply with all applicable data protection and privacy laws when using customer data</li>
                  <li>Respect the intellectual property rights of others</li>
                </ul>
              </section>

              <section>
                <h3 className="text-2xl font-semibold text-foreground mb-4">5. Third-Party Integrations</h3>
                <p className="text-foreground leading-relaxed mb-3">
                  The Service may integrate with third-party platforms including Facebook, Instagram, and other 
                  social media services. Your use of these integrations is subject to:
                </p>
                <ul className="list-disc list-inside space-y-1 text-foreground ml-4">
                  <li>The terms and conditions of the respective third-party platforms</li>
                  <li>The permissions you grant to AIPOS to access your third-party accounts</li>
                  <li>Meta's Platform Terms and Developer Policies (for Facebook and Instagram integrations)</li>
                </ul>
                <p className="text-foreground leading-relaxed mt-3">
                  We are not responsible for any issues arising from your use of third-party services or for 
                  changes to third-party APIs or policies that may affect the Service.
                </p>
              </section>

              <section>
                <h3 className="text-2xl font-semibold text-foreground mb-4">6. Intellectual Property</h3>
                <div className="space-y-3">
                  <div>
                    <h4 className="text-lg font-medium text-foreground mb-2">a) Our Rights</h4>
                    <p className="text-foreground">
                      The Service, including all content, features, and functionality, is owned by AIPOS and is 
                      protected by copyright, trademark, and other intellectual property laws. You may not copy, 
                      modify, distribute, sell, or lease any part of our Service without our express written permission.
                    </p>
                  </div>
                  <div>
                    <h4 className="text-lg font-medium text-foreground mb-2">b) Your Content</h4>
                    <p className="text-foreground">
                      You retain ownership of all content you upload to the Service (menu items, customer data, 
                      images, etc.). By uploading content, you grant us a license to use, store, and display your 
                      content solely for the purpose of providing the Service to you.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-2xl font-semibold text-foreground mb-4">7. Payment Terms</h3>
                <p className="text-foreground mb-3">
                  If you subscribe to a paid plan:
                </p>
                <ul className="list-disc list-inside space-y-1 text-foreground ml-4">
                  <li>You agree to pay all fees associated with your chosen plan</li>
                  <li>Fees are billed in advance on a recurring basis (monthly or annually)</li>
                  <li>All fees are non-refundable except as required by law</li>
                  <li>We reserve the right to change our fees with advance notice</li>
                  <li>You are responsible for any taxes associated with your use of the Service</li>
                </ul>
              </section>

              <section>
                <h3 className="text-2xl font-semibold text-foreground mb-4">8. Data and Privacy</h3>
                <p className="text-foreground leading-relaxed">
                  Your use of the Service is also governed by our Privacy Policy. You acknowledge that you have 
                  read and understood our Privacy Policy and agree to our collection, use, and disclosure of your 
                  information as described therein.
                </p>
              </section>

              <section>
                <h3 className="text-2xl font-semibold text-foreground mb-4">9. Service Availability and Modifications</h3>
                <div className="space-y-3">
                  <div>
                    <h4 className="text-lg font-medium text-foreground mb-2">a) Availability</h4>
                    <p className="text-foreground">
                      We strive to provide uninterrupted access to the Service but do not guarantee that the 
                      Service will be available at all times. We may experience downtime for maintenance, updates, 
                      or unforeseen circumstances.
                    </p>
                  </div>
                  <div>
                    <h4 className="text-lg font-medium text-foreground mb-2">b) Modifications</h4>
                    <p className="text-foreground">
                      We reserve the right to modify, suspend, or discontinue any part of the Service at any time 
                      with or without notice. We will not be liable to you or any third party for any modification, 
                      suspension, or discontinuation of the Service.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-2xl font-semibold text-foreground mb-4">10. Termination</h3>
                <p className="text-foreground mb-3">
                  Either party may terminate your account:
                </p>
                <ul className="list-disc list-inside space-y-1 text-foreground ml-4">
                  <li>You may cancel your account at any time through your account settings</li>
                  <li>We may suspend or terminate your account if you violate these Terms</li>
                  <li>We may terminate your account for prolonged inactivity</li>
                  <li>Upon termination, your right to use the Service will immediately cease</li>
                  <li>We will provide reasonable opportunity to export your data before account deletion</li>
                </ul>
              </section>

              <section>
                <h3 className="text-2xl font-semibold text-foreground mb-4">11. Disclaimers</h3>
                <p className="text-foreground leading-relaxed mb-3">
                  THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER 
                  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR 
                  A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
                </p>
                <p className="text-foreground leading-relaxed">
                  We do not warrant that the Service will be uninterrupted, secure, or error-free, or that any 
                  defects will be corrected. You use the Service at your own risk.
                </p>
              </section>

              <section>
                <h3 className="text-2xl font-semibold text-foreground mb-4">12. Limitation of Liability</h3>
                <p className="text-foreground leading-relaxed">
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, AIPOS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, 
                  SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED 
                  DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING 
                  FROM (A) YOUR USE OR INABILITY TO USE THE SERVICE; (B) ANY UNAUTHORIZED ACCESS TO OR USE OF OUR 
                  SERVERS; (C) ANY INTERRUPTION OR CESSATION OF THE SERVICE; OR (D) ANY ERRORS OR OMISSIONS IN ANY 
                  CONTENT.
                </p>
              </section>

              <section>
                <h3 className="text-2xl font-semibold text-foreground mb-4">13. Indemnification</h3>
                <p className="text-foreground leading-relaxed">
                  You agree to indemnify, defend, and hold harmless AIPOS and its officers, directors, employees, 
                  and agents from any claims, liabilities, damages, losses, and expenses, including reasonable 
                  attorneys' fees, arising out of or in any way connected with your access to or use of the Service, 
                  your violation of these Terms, or your violation of any rights of another party.
                </p>
              </section>

              <section>
                <h3 className="text-2xl font-semibold text-foreground mb-4">14. Changes to Terms</h3>
                <p className="text-foreground leading-relaxed">
                  We reserve the right to modify these Terms at any time. We will notify you of material changes 
                  by email or through the Service. Your continued use of the Service after such modifications 
                  constitutes your acceptance of the updated Terms.
                </p>
              </section>

              <section>
                <h3 className="text-2xl font-semibold text-foreground mb-4">15. Governing Law</h3>
                <p className="text-foreground leading-relaxed">
                  These Terms shall be governed by and construed in accordance with the laws of the jurisdiction 
                  in which AIPOS is registered, without regard to its conflict of law provisions.
                </p>
              </section>

              <section>
                <h3 className="text-2xl font-semibold text-foreground mb-4">16. Contact Information</h3>
                <p className="text-foreground leading-relaxed mb-3">
                  If you have any questions about these Terms, please contact us at:
                </p>
                <div className="bg-muted/50 rounded-lg p-4 space-y-1">
                  <p className="text-foreground font-medium">AIPOS</p>
                  <p className="text-muted-foreground">Email: support@aipos.com</p>
                  <p className="text-muted-foreground">Address: [Your Business Address]</p>
                </div>
              </section>

              <section>
                <h3 className="text-2xl font-semibold text-foreground mb-4">17. Severability</h3>
                <p className="text-foreground leading-relaxed">
                  If any provision of these Terms is found to be unenforceable or invalid, that provision will be 
                  limited or eliminated to the minimum extent necessary so that these Terms will otherwise remain 
                  in full force and effect.
                </p>
              </section>

              <section>
                <h3 className="text-2xl font-semibold text-foreground mb-4">18. Entire Agreement</h3>
                <p className="text-foreground leading-relaxed">
                  These Terms, together with our Privacy Policy, constitute the entire agreement between you and 
                  AIPOS regarding the use of the Service and supersede all prior agreements and understandings, 
                  whether written or oral.
                </p>
              </section>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default TermsOfService;
