import { PolicyEditor } from "@/components/policy-editor";

const BLANK_POLICY = {
  id: "",
  category: "hours_holidays",
  title: "",
  content: "",
  source: "authored",
  status: "active",
};

export default function NewPolicyPage() {
  return <PolicyEditor policy={BLANK_POLICY} isNew />;
}
