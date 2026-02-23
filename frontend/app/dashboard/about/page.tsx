import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Code2,
  Database,
  Globe,
  Mail,
  MapPin,
  Phone,
  Server,
  Smartphone,
  Calendar,
  Award,
  Users,
  Zap,
} from "lucide-react"

export default function AboutUs() {
  const skills = [
    { name: "React.js", category: "Frontend", icon: <Code2 className="h-4 w-4" /> },
    { name: "Next.js", category: "Frontend", icon: <Globe className="h-4 w-4" /> },
    { name: "Node.js", category: "Backend", icon: <Server className="h-4 w-4" /> },
    { name: "Express.js", category: "Backend", icon: <Server className="h-4 w-4" /> },
    { name: "MongoDB", category: "Database", icon: <Database className="h-4 w-4" /> },
    { name: "PostgreSQL", category: "Database", icon: <Database className="h-4 w-4" /> },
    { name: "TypeScript", category: "Language", icon: <Code2 className="h-4 w-4" /> },
    { name: "React Native", category: "Mobile", icon: <Smartphone className="h-4 w-4" /> },
  ]

  const services = [
    {
      title: "Web Development",
      description: "Complete web applications using modern technologies like React, Next.js, and Node.js",
      icon: <Globe className="h-6 w-6" />,
    },
    {
      title: "Mobile App Development",
      description: "Cross-platform mobile applications using React Native for iOS and Android",
      icon: <Smartphone className="h-6 w-6" />,
    },
    {
      title: "Backend Development",
      description: "Robust server-side solutions with APIs, databases, and cloud integration",
      icon: <Server className="h-6 w-6" />,
    },
    {
      title: "Database Design",
      description: "Efficient database architecture and optimization for scalable applications",
      icon: <Database className="h-6 w-6" />,
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Hero Section */}
      <section className="relative py-24 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600"></div>
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative max-w-6xl mx-auto text-center text-white">
          <div className="mb-8">
            <div className="w-40 h-40 mx-auto mb-8 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-2xl">
              <Code2 className="h-20 w-20 text-white" />
            </div>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
              Fullstack Developer
            </h1>
            <p className="text-xl md:text-2xl text-blue-100 mb-8 max-w-3xl mx-auto leading-relaxed">
              Crafting exceptional digital experiences with cutting-edge technologies and 2+ years of proven expertise
            </p>
            <div className="flex flex-wrap justify-center gap-3 mb-10">
              <Badge
                variant="secondary"
                className="text-sm py-2 px-4 bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20"
              >
                <Calendar className="h-4 w-4 mr-2" />
                2+ Years Experience
              </Badge>
              <Badge
                variant="secondary"
                className="text-sm py-2 px-4 bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20"
              >
                <Award className="h-4 w-4 mr-2" />
                Fullstack Expert
              </Badge>
              <Badge
                variant="secondary"
                className="text-sm py-2 px-4 bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20"
              >
                <Zap className="h-4 w-4 mr-2" />
                Fast Delivery
              </Badge>
            </div>
            {/* <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50 shadow-xl">
              <Mail className="h-5 w-5 mr-2" />
              Let's Connect
            </Button> */}
          </div>
        </div>
      </section>

      {/* Skills Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">Technical Arsenal</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Mastering the complete technology stack to build powerful, scalable applications
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {skills.map((skill, index) => (
              <Card
                key={index}
                className="group hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-0 bg-gradient-to-br from-white to-slate-50"
              >
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <div className="text-white">{skill.icon}</div>
                  </div>
                  <h3 className="font-bold text-lg mb-2 text-gray-900">{skill.name}</h3>
                  <Badge variant="outline" className="text-sm border-blue-200 text-blue-600">
                    {skill.category}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">What I Offer</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              End-to-end development solutions tailored to bring your vision to life
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {services.map((service, index) => (
              <Card
                key={index}
                className="group hover:shadow-2xl transition-all duration-500 hover:-translate-y-3 border-0 bg-white/80 backdrop-blur-sm"
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl group-hover:scale-110 transition-transform duration-300">
                      <div className="text-white">{service.icon}</div>
                    </div>
                    <CardTitle className="text-2xl text-gray-900">{service.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-lg text-gray-600 leading-relaxed">
                    {service.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Me Section */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">Why Choose Me?</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Delivering excellence through passion, expertise, and dedication
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            <div className="text-center group">
              <div className="w-24 h-24 bg-gradient-to-r from-green-400 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 shadow-xl">
                <Zap className="h-12 w-12 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-gray-900">Lightning Fast</h3>
              <p className="text-lg text-gray-600 leading-relaxed">
                Quick turnaround time without compromising on quality and attention to detail
              </p>
            </div>

            <div className="text-center group">
              <div className="w-24 h-24 bg-gradient-to-r from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 shadow-xl">
                <Code2 className="h-12 w-12 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-gray-900">Clean Code</h3>
              <p className="text-lg text-gray-600 leading-relaxed">
                Well-structured, maintainable, and scalable code following industry best practices
              </p>
            </div>

            <div className="text-center group">
              <div className="w-24 h-24 bg-gradient-to-r from-purple-400 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 shadow-xl">
                <Users className="h-12 w-12 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-gray-900">24/7 Support</h3>
              <p className="text-lg text-gray-600 leading-relaxed">
                Dedicated support and clear communication throughout the entire project lifecycle
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 px-4 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Let's Work Together</h2>
          <p className="text-xl mb-8 opacity-90">Ready to bring your ideas to life? Let's discuss your next project!</p>

          <div className="flex flex-wrap justify-center gap-6 mb-8">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              <span>webxlearner07@gmail.com</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              <span>+91 9027130674</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              <span>India</span>
            </div>
          </div>

          {/* <Button size="lg" variant="secondary" className="text-blue-600 hover:text-blue-700">
            <Mail className="h-4 w-4 mr-2" />
            Get In Touch
          </Button> */}
        </div>
      </section>
    </div>
  )
}