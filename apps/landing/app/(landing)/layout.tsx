import "./factory.css"

// The landing's root: factory.css scopes every rule under .factory. The fonts come from the root layout: section titles are Newsreader, the "persona" word is Nunito, the big hero title is Georgia (a system font) and the text is the site's Geist
export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className="factory">{children}</div>
}
