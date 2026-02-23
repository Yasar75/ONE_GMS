 import ContactForm from "@/components/contact/contact-form"

export const metadata = {
  title: "Contact Us — WebXLearner",
  description: "Get in touch with WebXLearner for MERN, Django, and GenAI projects.",
}


export default function ContactPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-balance text-3xl font-semibold">Contact Us</h1>
        
      </header>

      <section aria-labelledby="contact-form">
        <h2 id="contact-form" className="sr-only">
          Contact form
        </h2>
        <ContactForm to="webxlearner07@gmail.com" />
      </section>
    </main>
  )
}
