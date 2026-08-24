import { ChevronRight, Utensils } from "lucide-react";

import { List, ListIcon } from "~/common/ui";

type MenuUtilityBannerProps = {
  href: string;
  subtitle: string;
  title: string;
};

export const MenuUtilityBanner = ({ href, subtitle, title }: MenuUtilityBannerProps) => (
  <List
    className="rounded-[24px] border-primary/12 bg-primary/[0.045] dark:bg-primary/[0.08]"
    items={[
      {
        addon: {
          after: <ChevronRight aria-hidden="true" size={20} strokeWidth={2.15} />,
          before: (
            <ListIcon className="size-11 rounded-[14px] bg-primary text-white [&>svg]:size-5">
              <Utensils aria-hidden="true" />
            </ListIcon>
          )
        },
        href,
        spacing: "md",
        subtitle,
        title: <span className="font-semibold">{title}</span>
      }
    ]}
  />
);
