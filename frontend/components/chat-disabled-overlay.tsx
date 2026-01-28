"use client";

import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

export default function ChatDisabledOverlay() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <Card className="w-[90%] max-w-md text-center shadow-xl">
        <CardHeader>
          <CardTitle className="text-xl">
            AI Temporarily Disabled
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Currently, I do not have the financial means for a working AI key.
          </p>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button
            variant="ghost"
            onClick={() => setIsOpen(!isOpen)}
            className="group flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="text-sm">Why? It&apos;s just $5...</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-300 ease-in-out ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </Button>

          <div
            className={`grid transition-all duration-300 ease-in-out ${
              isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="overflow-hidden">
              <div className="rounded-lg bg-muted/50 p-4 text-left border border-border/50">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  I am a student and, with the market as it is, I cannot find employment while I am writing this.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed mt-3">
                  I am not asking for pity, just understanding. I feel sorry that an important part of the project, that I developed, cannot see the light of day right now.
                </p>
              </div>
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
