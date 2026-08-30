// This file configures i18next — the library that lets the same
// component render in different languages depending on what the
// user picked. Every piece of translatable text lives in the
// "resources" object below, organized by language code (en/hi/gu)
// then by page. Components call useTranslation() and t('some.key')
// instead of hardcoding English text directly — see Header.tsx,
// Landing.tsx, and RequestHelp.tsx for how that looks in practice.

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      header: { liveMap: 'Live Map', requestHelp: 'Request Help', signOut: 'Sign out' },
      landing: {
        badge: 'Flood & disaster response network',
        subhead: 'Help finds you',
        description:
          'Nirvaan connects people trapped, stranded or in need with the nearest available volunteers, rescue teams and relief organizations — in real time.',
        requestHelpBtn: 'Request Help',
        emergencySos: 'Emergency SOS',
        volunteerSignup: 'Volunteer Login / Signup',
        ngoSignup: 'NGO / Organization Login / Signup',
        disclaimer: 'In immediate danger? Call local emergency services first.',
        howItWorks: 'How it works',
        step1Title: '1. Report',
        step1Desc: 'Anyone can drop a pin and describe the situation. No account needed.',
        step2Title: '2. Triage',
        step2Desc: 'AI reads the description and assigns a category and urgency instantly.',
        step3Title: '3. Respond',
        step3Desc: 'Nearby volunteers, teams and NGOs see it live and get assigned.',
        liveMapLink: 'Live Map →',
        alreadyVolunteer: 'Already a volunteer?',
        logIn: 'Log in',
      },
      requestHelp: {
        title: 'Request help',
        subtitle: 'Fill this in as best you can — every field helps volunteers reach you faster.',
        yourName: 'Your name',
        phoneNumber: 'Phone number',
        whoNeedsHelp: 'Who needs help?',
        relationshipSelf: 'Myself',
        relationshipRelative: 'A relative',
        relationshipNeighbor: 'A neighbor',
        relationshipOther: 'Someone else',
        location: 'Location',
        landmark: 'Nearby landmark (optional)',
        landmarkPlaceholder: 'e.g. opposite the blue water tank',
        description: 'What kind of help is needed?',
        descriptionPlaceholder: 'Describe the situation — this helps us understand how urgent it is',
        submit: 'Send SOS request',
        sending: 'Sending...',
        mapHint: 'Tap anywhere on the map to mark the location. You can drag the pin afterward to fine-tune it.',
        locationSet: 'Location set',
        confirmTitle: 'Help is on the way',
        confirmBody: 'Your request has been received and is visible to nearby volunteers and NGOs.',
        trackingId: 'Tracking ID',
      },
    },
  },
  hi: {
    translation: {
      header: { liveMap: 'लाइव मैप', requestHelp: 'मदद माँगें', signOut: 'साइन आउट' },
      landing: {
        badge: 'बाढ़ और आपदा राहत नेटवर्क',
        subhead: 'मदद आप तक पहुँचेगी',
        description:
          'निर्वाण फंसे हुए, बेसहारा या ज़रूरतमंद लोगों को नज़दीकी उपलब्ध स्वयंसेवकों, बचाव दलों और राहत संगठनों से रीयल-टाइम में जोड़ता है।',
        requestHelpBtn: 'मदद माँगें',
        emergencySos: 'आपातकालीन SOS',
        volunteerSignup: 'स्वयंसेवक लॉगिन / साइनअप',
        ngoSignup: 'एनजीओ / संस्था लॉगिन / साइनअप',
        disclaimer: 'तत्काल खतरे में हैं? पहले स्थानीय आपातकालीन सेवाओं को कॉल करें।',
        howItWorks: 'यह कैसे काम करता है',
        step1Title: '1. रिपोर्ट करें',
        step1Desc: 'कोई भी पिन लगाकर स्थिति बता सकता है। खाते की ज़रूरत नहीं।',
        step2Title: '2. वर्गीकरण',
        step2Desc: 'AI विवरण पढ़कर तुरंत श्रेणी और तात्कालिकता तय करता है।',
        step3Title: '3. प्रतिक्रिया',
        step3Desc: 'आस-पास के स्वयंसेवक, टीमें और एनजीओ इसे लाइव देखते हैं और नियुक्त होते हैं।',
        liveMapLink: 'लाइव मैप →',
        alreadyVolunteer: 'पहले से स्वयंसेवक हैं?',
        logIn: 'लॉग इन करें',
      },
      requestHelp: {
        title: 'मदद माँगें',
        subtitle: 'जितना हो सके भरें — हर जानकारी स्वयंसेवकों को जल्दी पहुँचने में मदद करती है।',
        yourName: 'आपका नाम',
        phoneNumber: 'फ़ोन नंबर',
        whoNeedsHelp: 'किसे मदद चाहिए?',
        relationshipSelf: 'मुझे',
        relationshipRelative: 'एक रिश्तेदार को',
        relationshipNeighbor: 'एक पड़ोसी को',
        relationshipOther: 'किसी और को',
        location: 'स्थान',
        landmark: 'नज़दीकी पहचान चिह्न (वैकल्पिक)',
        landmarkPlaceholder: 'जैसे नीली पानी की टंकी के सामने',
        description: 'किस तरह की मदद चाहिए?',
        descriptionPlaceholder: 'स्थिति बताएं — इससे तात्कालिकता समझने में मदद मिलती है',
        submit: 'SOS भेजें',
        sending: 'भेजा जा रहा है...',
        mapHint: 'स्थान चिह्नित करने के लिए मैप पर कहीं भी टैप करें। बाद में पिन को खींचकर ठीक कर सकते हैं।',
        locationSet: 'स्थान सेट किया गया',
        confirmTitle: 'मदद आ रही है',
        confirmBody: 'आपका अनुरोध प्राप्त हो गया है और आस-पास के स्वयंसेवकों व एनजीओ को दिखाई दे रहा है।',
        trackingId: 'ट्रैकिंग आईडी',
      },
    },
  },
  gu: {
    translation: {
      header: { liveMap: 'લાઈવ મેપ', requestHelp: 'મદદ માંગો', signOut: 'સાઇન આઉટ' },
      landing: {
        badge: 'પૂર અને આપત્તિ રાહત નેટવર્ક',
        subhead: 'મદદ તમારા સુધી પહોંચશે',
        description:
          'નિર્વાણ ફસાયેલા, અટવાયેલા અથવા જરૂરિયાતમંદ લોકોને નજીકના ઉપલબ્ધ સ્વયંસેવકો, બચાવ ટીમો અને રાહત સંસ્થાઓ સાથે રીઅલ-ટાઇમમાં જોડે છે.',
        requestHelpBtn: 'મદદ માંગો',
        emergencySos: 'ઇમરજન્સી SOS',
        volunteerSignup: 'સ્વયંસેવક લોગિન / સાઇનઅપ',
        ngoSignup: 'એનજીઓ / સંસ્થા લોગિન / સાઇનઅપ',
        disclaimer: 'તાત્કાલિક જોખમમાં છો? પહેલા સ્થાનિક ઇમરજન્સી સેવાઓને કૉલ કરો.',
        howItWorks: 'આ કેવી રીતે કામ કરે છે',
        step1Title: '1. જાણ કરો',
        step1Desc: 'કોઈપણ પિન મૂકીને પરિસ્થિતિ જણાવી શકે છે. ખાતાની જરૂર નથી.',
        step2Title: '2. વર્ગીકરણ',
        step2Desc: 'AI વર્ણન વાંચીને તરત જ શ્રેણી અને તાકીદ નક્કી કરે છે.',
        step3Title: '3. પ્રતિસાદ',
        step3Desc: 'નજીકના સ્વયંસેવકો, ટીમો અને એનજીઓ તેને લાઈવ જુએ છે અને સોંપાય છે.',
        liveMapLink: 'લાઈવ મેપ →',
        alreadyVolunteer: 'પહેલેથી સ્વયંસેવક છો?',
        logIn: 'લોગ ઇન કરો',
      },
      requestHelp: {
        title: 'મદદ માંગો',
        subtitle: 'બને એટલું ભરો — દરેક વિગત સ્વયંસેવકોને ઝડપથી પહોંચવામાં મદદ કરે છે.',
        yourName: 'તમારું નામ',
        phoneNumber: 'ફોન નંબર',
        whoNeedsHelp: 'કોને મદદ જોઈએ છે?',
        relationshipSelf: 'મને',
        relationshipRelative: 'એક સંબંધીને',
        relationshipNeighbor: 'એક પડોશીને',
        relationshipOther: 'બીજા કોઈને',
        location: 'સ્થળ',
        landmark: 'નજીકનું ઓળખચિહ્ન (વૈકલ્પિક)',
        landmarkPlaceholder: 'દા.ત. વાદળી પાણીની ટાંકીની સામે',
        description: 'કેવા પ્રકારની મદદ જોઈએ છે?',
        descriptionPlaceholder: 'પરિસ્થિતિ વર્ણવો — આ તાકીદ સમજવામાં મદદ કરે છે',
        submit: 'SOS મોકલો',
        sending: 'મોકલાઈ રહ્યું છે...',
        mapHint: 'સ્થળ ચિહ્નિત કરવા મેપ પર ગમે ત્યાં ટેપ કરો. પછી પિનને ખેંચીને સરખું કરી શકાય છે.',
        locationSet: 'સ્થળ સેટ થયું',
        confirmTitle: 'મદદ આવી રહી છે',
        confirmBody: 'તમારી વિનંતી મળી ગઈ છે અને નજીકના સ્વયંસેવકો અને એનજીઓને દેખાઈ રહી છે.',
        trackingId: 'ટ્રેકિંગ આઈડી',
      },
    },
  },
};

i18n
  // Detects the user's previously saved choice (via localStorage) or
  // their browser's language setting, so returning visitors don't
  // have to re-pick every time — this is the "persists across their
  // session" requirement from the original spec.
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: { escapeValue: false }, // React already escapes output, so this avoids double-escaping
  });

export default i18n;
