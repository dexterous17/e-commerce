import { useEffect } from "react";

function setMetaContent(name, content) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content ?? "");
}

const Meta = ({
  title = "Tailored by Boutique",
  description = "",
  keywords = "",
}) => {
  useEffect(() => {
    document.title = title;
    setMetaContent("description", description);
    setMetaContent("keyword", keywords);
  }, [title, description, keywords]);

  return null;
};

export default Meta;
