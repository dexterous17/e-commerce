// Plain Bootstrap markup avoids react-bootstrap Alert's defaultProps (deprecated in React 18.3 dev).
const Message = ({ variant = "info", children }) => (
  <div className={`alert alert-${variant}`} role="alert">
    {children}
  </div>
);

export default Message;
