import Link from "next/link"

interface PublicFooterProps {
  showLocale?: boolean
  LocaleSwitcherComponent?: React.ReactNode
}

export function PublicFooter({ showLocale = false, LocaleSwitcherComponent }: PublicFooterProps) {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-6xl mx-auto px-6 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">

          {/* Company */}
          <div>
            <h3 className="text-white font-semibold text-sm mb-4 tracking-wide">Company</h3>
            <ul className="space-y-3">
              <li><Link href="/about" className="text-sm hover:text-white transition-colors">About Us</Link></li>
              <li><Link href="/contact" className="text-sm hover:text-white transition-colors">Contact Us</Link></li>
              <li><Link href="/blog" className="text-sm hover:text-white transition-colors">Blog</Link></li>
              <li><Link href="/faq" className="text-sm hover:text-white transition-colors">FAQ</Link></li>
              <li><Link href="/careers" className="text-sm hover:text-white transition-colors">Careers</Link></li>
            </ul>
          </div>

          {/* Legal Information */}
          <div>
            <h3 className="text-white font-semibold text-sm mb-4 tracking-wide">Legal Information</h3>
            <ul className="space-y-3">
              <li><Link href="/terms" className="text-sm hover:text-white transition-colors">Subscription terms</Link></li>
              <li><Link href="/terms" className="text-sm hover:text-white transition-colors">Terms and conditions</Link></li>
              <li><Link href="/refund-policy" className="text-sm hover:text-white transition-colors">Refund policy</Link></li>
              <li><Link href="/privacy" className="text-sm hover:text-white transition-colors">Privacy policy</Link></li>
              <li><Link href="/cookie-policy" className="text-sm hover:text-white transition-colors">Cookie Policy</Link></li>
              <li><Link href="/do-not-sell" className="text-sm hover:text-white transition-colors">Do not sell or share my personal data</Link></li>
              <li><Link href="/collection-notice" className="text-sm hover:text-white transition-colors">Notice at Collection</Link></li>
            </ul>
          </div>

          {/* Follow Us */}
          <div>
            <h3 className="text-white font-semibold text-sm mb-4 tracking-wide">Follow Us</h3>
            <ul className="space-y-3">
              <li>
                <a href="https://linkedin.com/company/summontranslator" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm hover:text-white transition-colors">
                  <LinkedInIcon />
                  LinkedIn
                </a>
              </li>
              <li>
                <a href="https://facebook.com/summontranslator" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm hover:text-white transition-colors">
                  <FacebookIcon />
                  Facebook
                </a>
              </li>
              <li>
                <a href="https://x.com/summontranslator" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm hover:text-white transition-colors">
                  <XIcon />
                  X
                </a>
              </li>
              <li>
                <a href="https://pinterest.com/summontranslator" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm hover:text-white transition-colors">
                  <PinterestIcon />
                  Pinterest
                </a>
              </li>
            </ul>
          </div>

          {/* Language */}
          <div>
            <h3 className="text-white font-semibold text-sm mb-4 tracking-wide">Language</h3>
            {showLocale && LocaleSwitcherComponent ? (
              <div className="locale-switcher-dark">
                {LocaleSwitcherComponent}
              </div>
            ) : (
              <div className="text-sm text-gray-400">English</div>
            )}
          </div>

        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-700 mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="font-bold text-indigo-400 tracking-tight text-sm">Summon Translator</span>
          <p className="text-xs text-gray-500">© {new Date().getFullYear()} Summon Translator. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}

function LinkedInIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  )
}

function PinterestIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
    </svg>
  )
}
