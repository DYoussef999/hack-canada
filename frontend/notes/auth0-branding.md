# Auth0 Universal Login Branding Instructions

Go to: Auth0 Dashboard → Branding → Universal Login

## Colors Tab:
- Page Background:       #27391C
- Primary Button:        #FFFFFF
- Primary Button Label:  #27391C
- Widget Background:     #344D26
- Widget Border:         #3F5C2E
- Header:                #FFFFFF
- Body Text:             #F5F0E8
- Link:                  #8BAF6A

## Fonts Tab:
- Font URL: https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap
- Font Family: DM Sans

## Widget Tab:
- Logo URL: (upload your LaunchPad AI logo, or leave blank for now)
- Favicon URL: (optional)
- Border Radius: 16px
- Social Buttons Layout: Bottom

## Custom CSS (paste into the Custom CSS box):

```css
body {
  background-color: #27391C !important;
  font-family: 'DM Sans', sans-serif !important;
}

.c6a2f7b61 {
  background: #344D26 !important;
  border: 1px solid #3F5C2E !important;
  border-radius: 16px !important;
  box-shadow: 0 25px 60px rgba(0,0,0,0.4) !important;
}

/* Primary button */
[data-action-button-primary] {
  background: #FFFFFF !important;
  color: #27391C !important;
  font-weight: 700 !important;
  border-radius: 10px !important;
}

/* Social button (Google) */
[data-provider="google-oauth2"] {
  border: 1px solid #3F5C2E !important;
  color: #F5F0E8 !important;
  border-radius: 10px !important;
}

/* Input fields */
input[type="email"], input[type="password"], input[type="text"] {
  background: #27391C !important;
  border: 1px solid #3F5C2E !important;
  color: #F5F0E8 !important;
  border-radius: 10px !important;
}

input::placeholder {
  color: #5A7A40 !important;
}

/* Links */
a {
  color: #8BAF6A !important;
}

/* Heading */
h1 {
  color: #FFFFFF !important;
  font-weight: 700 !important;
}

/* Body text */
p, label, span {
  color: #F5F0E8 !important;
}

/* Remove the Auth0 "Dev Keys" warning banner styling */
[class*="alert"], [class*="warning"], [class*="banner"] {
  background: #344D26 !important;
  border-color: #8BAF6A !important;
  color: #8BAF6A !important;
}
```
